/**
 * Rutas HTTP de media (`/api/media/*`).
 * Persistencia de avatarUrl → servicio identity vía HTTP (sin MongoDB aquí).
 */
import { Router, Request, Response } from 'express';
import {
  AVATAR_MAX_BYTES,
  deleteAvatarFiles,
  legacyClientAvatarPath,
  saveAvatarFile,
  serveAvatarFile,
} from '../services/AvatarService';
import { patchUserAvatarUrl, verifyBearerToken, type IdentityPublicUser } from '../services/identityClient';
import multer from 'multer';

const router = Router();

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error('invalid_image_type'));
  },
});

function getAuthorization(req: Request): string | null {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header : null;
}

async function resolveUserId(req: Request): Promise<string | null> {
  const fromHeader = req.headers['x-user-id'];
  if (typeof fromHeader === 'string' && OBJECT_ID_RE.test(fromHeader.trim())) {
    return fromHeader.trim();
  }
  const auth = getAuthorization(req);
  if (!auth) return null;
  return verifyBearerToken(auth);
}

/** URL que el móvil resuelve vía gateway (`/api/auth/avatars/...`). */
function toClientUser(user: IdentityPublicUser): IdentityPublicUser {
  const avatarUrl = user.avatarUrl ? legacyClientAvatarPath(user.id) : undefined;
  return {
    ...user,
    avatarUrl,
    stats: user.stats ?? {
      gamesPlayed: 0,
      mvpCount: 0,
      winsByTeam: {},
      favoriteRoles: [],
    },
    linkedGuestIds: user.linkedGuestIds ?? [],
    createdAt: user.createdAt ?? new Date().toISOString(),
  };
}

router.post('/avatar', (req, res, next) => {
  avatarUpload.single('avatar')(req, res, (err: unknown) => {
    if (err) {
      const code = err instanceof Error ? err.message : 'avatar_upload_failed';
      const status = code === 'avatar_too_large' ? 413 : 400;
      res.status(status).json({ error: code, code });
      return;
    }
    next();
  });
}, async (req, res) => {
  const authorization = getAuthorization(req);
  const userId = await resolveUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Token inválido', code: 'unauthorized' });
    return;
  }
  if (!req.file?.buffer) {
    res.status(400).json({ error: 'Archivo avatar requerido', code: 'avatar_required' });
    return;
  }
  try {
    const storedPath = await saveAvatarFile(userId, req.file.buffer, req.file.mimetype);
    const updated = await patchUserAvatarUrl(userId, storedPath, authorization ?? undefined);
    const user = updated.user ? toClientUser(updated.user) : null;
    res.json({ ok: true, user });
  } catch (err: unknown) {
    const code = err instanceof Error ? err.message : 'avatar_upload_failed';
    const status = code === 'avatar_too_large' ? 413 : 400;
    res.status(status).json({ error: code, code });
  }
});

router.delete('/avatar', async (req, res) => {
  const authorization = getAuthorization(req);
  const userId = await resolveUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Token inválido', code: 'unauthorized' });
    return;
  }
  try {
    await deleteAvatarFiles(userId);
    const updated = await patchUserAvatarUrl(userId, null, authorization ?? undefined);
    const user = updated.user ? toClientUser(updated.user) : null;
    res.json({ ok: true, user });
  } catch (err: unknown) {
    const code = err instanceof Error ? err.message : 'avatar_delete_failed';
    res.status(400).json({ error: code, code });
  }
});

router.get('/avatars/:userId', async (req, res) => {
  const userId = String(req.params.userId ?? '');
  if (!OBJECT_ID_RE.test(userId)) {
    res.status(404).end();
    return;
  }
  const served = await serveAvatarFile(userId, res);
  if (!served) res.status(404).end();
});

export default router;
