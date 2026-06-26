/**
 * Rutas HTTP de identidad (`/api/auth/*`).
 * Avatares (upload/serve) → servicio `media` (pendiente).
 */
import { Router } from 'express';
import { isJwtConfigured, signAccessToken } from '../auth/jwt';
import { authUnavailable, bearerUserId } from '../middleware/auth';
import {
  createAuthSession,
  revokeAuthSession,
  rotateAuthSession,
} from '../services/AuthSessionService';
import { listParticipationsByUser } from '../services/GameParticipationService';
import { isMongoEnabled } from '../services/mongoConnection';
import {
  changeUserPassword,
  changeUsername,
  findUserById,
  getPublicUser,
  linkGuestToUser,
  loginUser,
  registerUser,
  toPublicUser,
  updateUserAvatarUrl,
} from '../services/UserService';
import { MEDIA_PUBLIC_URL, INTERNAL_SERVICE_KEY } from '../config/env';
import { logger } from '../utils/logger';

const router = Router();

function enrichAvatarUrl<T extends { id: string; avatarUrl?: string }>(user: T): T {
  if (!user.avatarUrl) return user;
  if (user.avatarUrl.startsWith('http')) return user;
  if (user.avatarUrl.startsWith('/api/media/avatars/') || user.avatarUrl.startsWith('/api/auth/avatars/')) {
    return { ...user, avatarUrl: user.avatarUrl.replace(/^\/api\/media/, '/api/auth') };
  }
  if (user.avatarUrl.startsWith('/api/') && MEDIA_PUBLIC_URL) {
    return { ...user, avatarUrl: `${MEDIA_PUBLIC_URL}${user.avatarUrl}` };
  }
  return user;
}

router.get('/status', (_req, res) => {
  res.json({
    enabled: isMongoEnabled() && isJwtConfigured(),
    requiresMongo: true,
    requiresJwtSecret: true,
    guestPlayAllowed: true,
    service: 'identity',
  });
});

router.post('/register', async (req, res) => {
  if (authUnavailable(res)) return;
  try {
    const { email, username, password, preferredLocale } = req.body ?? {};
    const user = await registerUser({ email, username, password, preferredLocale });
    const session = await createAuthSession(user.id, req.body?.deviceId);
    const accessToken = signAccessToken({ sub: user.id, username: user.username, email: user.email });
    res.status(201).json({
      user: enrichAvatarUrl(user),
      accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt.toISOString(),
    });
  } catch (err: unknown) {
    const code = err instanceof Error ? err.message : 'register_failed';
    const status = ['username_taken', 'email_taken'].includes(code) ? 409 : 400;
    res.status(status).json({ error: code, code });
  }
});

router.post('/login', async (req, res) => {
  if (authUnavailable(res)) return;
  try {
    const { login, password, deviceId } = req.body ?? {};
    const doc = await loginUser(String(login ?? ''), String(password ?? ''));
    const user = toPublicUser(doc);
    const session = await createAuthSession(user.id, deviceId);
    const accessToken = signAccessToken({ sub: user.id, username: user.username, email: user.email });
    res.json({
      user: enrichAvatarUrl(user),
      accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt.toISOString(),
    });
  } catch {
    res.status(401).json({ error: 'Credenciales inválidas', code: 'invalid_credentials' });
  }
});

router.post('/refresh', async (req, res) => {
  if (authUnavailable(res)) return;
  const refreshToken = String(req.body?.refreshToken ?? '');
  const rotated = await rotateAuthSession(refreshToken);
  if (!rotated) {
    res.status(401).json({ error: 'Sesión expirada', code: 'invalid_refresh_token' });
    return;
  }
  const user = await getPublicUser(rotated.userId);
  if (!user) {
    res.status(401).json({ error: 'Usuario no encontrado', code: 'user_not_found' });
    return;
  }
  const accessToken = signAccessToken({ sub: user.id, username: user.username, email: user.email });
  res.json({ user: enrichAvatarUrl(user), accessToken, refreshToken: rotated.newRefreshToken });
});

router.post('/logout', async (req, res) => {
  if (authUnavailable(res)) return;
  const refreshToken = String(req.body?.refreshToken ?? '');
  if (refreshToken) await revokeAuthSession(refreshToken);
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  if (authUnavailable(res)) return;
  const userId = bearerUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Token inválido', code: 'unauthorized' });
    return;
  }
  const user = await getPublicUser(userId);
  if (!user) {
    res.status(404).json({ error: 'Usuario no encontrado', code: 'user_not_found' });
    return;
  }
  res.json({ user: enrichAvatarUrl(user) });
});

router.get('/profile', async (req, res) => {
  if (authUnavailable(res)) return;
  const userId = bearerUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Token inválido', code: 'unauthorized' });
    return;
  }
  const doc = await findUserById(userId);
  if (!doc) {
    res.status(404).json({ error: 'Usuario no encontrado', code: 'user_not_found' });
    return;
  }
  const participations = await listParticipationsByUser(userId);
  res.json({
    user: enrichAvatarUrl(toPublicUser(doc)),
    participations: participations.map((p) => ({
      roomId: p.roomId,
      playerName: p.playerName,
      role: p.role,
      team: p.team,
      won: p.won,
      isMvp: p.isMvp,
      eliminatedOnDay: p.eliminatedOnDay,
      finishedAt: p.finishedAt.toISOString(),
    })),
  });
});

/** Actualización de avatarUrl desde servicio media (HTTP interno). */
router.patch('/users/:userId/avatar', async (req, res) => {
  if (authUnavailable(res)) return;

  const targetUserId = String(req.params.userId ?? '').trim();
  const callerUserId = bearerUserId(req);
  const internalOk =
    Boolean(INTERNAL_SERVICE_KEY) &&
    req.headers['x-internal-service'] === 'media' &&
    req.headers['x-internal-service-key'] === INTERNAL_SERVICE_KEY;

  if (!callerUserId && !internalOk) {
    res.status(401).json({ error: 'Token inválido', code: 'unauthorized' });
    return;
  }
  if (callerUserId && callerUserId !== targetUserId && !internalOk) {
    res.status(403).json({ error: 'No autorizado', code: 'forbidden' });
    return;
  }

  const body = req.body ?? {};
  if (!('avatarUrl' in body)) {
    res.status(400).json({ error: 'avatarUrl requerido', code: 'avatar_url_required' });
    return;
  }

  const raw = body.avatarUrl;
  const avatarUrl = raw === null || raw === '' ? null : String(raw).trim();
  if (
    avatarUrl &&
    !/^https?:\/\//i.test(avatarUrl) &&
    !avatarUrl.startsWith('/api/media/avatars/') &&
    !avatarUrl.startsWith('/api/auth/avatars/')
  ) {
    res.status(400).json({ error: 'avatarUrl inválida', code: 'invalid_avatar_url' });
    return;
  }

  await updateUserAvatarUrl(targetUserId, avatarUrl);
  const user = await getPublicUser(targetUserId);
  res.json({ ok: true, user: user ? enrichAvatarUrl(user) : null });
});

/** Perfil público por id (media / servicios internos). */
router.get('/users/:userId', async (req, res) => {
  if (authUnavailable(res)) return;
  const targetUserId = String(req.params.userId ?? '').trim();
  const callerUserId = bearerUserId(req);
  const internalOk =
    Boolean(INTERNAL_SERVICE_KEY) &&
    req.headers['x-internal-service'] === 'media' &&
    req.headers['x-internal-service-key'] === INTERNAL_SERVICE_KEY;

  if (!callerUserId && !internalOk) {
    res.status(401).json({ error: 'Token inválido', code: 'unauthorized' });
    return;
  }
  if (callerUserId && callerUserId !== targetUserId && !internalOk) {
    res.status(403).json({ error: 'No autorizado', code: 'forbidden' });
    return;
  }

  const user = await getPublicUser(targetUserId);
  if (!user) {
    res.status(404).json({ error: 'Usuario no encontrado', code: 'user_not_found' });
    return;
  }
  res.json({ user: enrichAvatarUrl(user) });
});

/** URL externa de avatar (el blob lo gestiona el servicio media). */
router.patch('/profile', async (req, res) => {
  if (authUnavailable(res)) return;
  const userId = bearerUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Token inválido', code: 'unauthorized' });
    return;
  }
  const body = req.body ?? {};
  if (typeof body.avatarUrl !== 'string') {
    res.status(400).json({ error: 'Nada que actualizar', code: 'no_updates' });
    return;
  }
  const avatarUrl = body.avatarUrl.trim();
  if (
    avatarUrl &&
    !/^https?:\/\//i.test(avatarUrl) &&
    !avatarUrl.startsWith('/api/media/avatars/') &&
    !avatarUrl.startsWith('/api/auth/avatars/')
  ) {
    res.status(400).json({ error: 'avatarUrl debe ser http(s) o ruta /api/*/avatars/', code: 'invalid_avatar_url' });
    return;
  }
  await updateUserAvatarUrl(userId, avatarUrl || null);
  const user = await getPublicUser(userId);
  res.json({ user: user ? enrichAvatarUrl(user) : null });
});

router.post('/change-username', async (req, res) => {
  if (authUnavailable(res)) return;
  const userId = bearerUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Token inválido', code: 'unauthorized' });
    return;
  }
  const currentPassword = String(req.body?.currentPassword ?? '');
  const username = String(req.body?.username ?? '');
  if (!currentPassword || !username.trim()) {
    res.status(400).json({ error: 'Datos incompletos', code: 'username_change_required' });
    return;
  }
  try {
    const user = await changeUsername(userId, currentPassword, username);
    res.json({ user: enrichAvatarUrl(user) });
  } catch (err: unknown) {
    const code = err instanceof Error ? err.message : 'username_change_failed';
    const status =
      code === 'invalid_current_password' ? 401 : code === 'username_taken' ? 409 : 400;
    res.status(status).json({ error: code, code });
  }
});

router.post('/change-password', async (req, res) => {
  if (authUnavailable(res)) return;
  const userId = bearerUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Token inválido', code: 'unauthorized' });
    return;
  }
  const currentPassword = String(req.body?.currentPassword ?? '');
  const newPassword = String(req.body?.newPassword ?? '');
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Contraseñas requeridas', code: 'password_required' });
    return;
  }
  try {
    await changeUserPassword(userId, currentPassword, newPassword);
    res.json({ ok: true });
  } catch (err: unknown) {
    const code = err instanceof Error ? err.message : 'password_change_failed';
    const status = code === 'invalid_current_password' ? 401 : 400;
    res.status(status).json({ error: code, code });
  }
});

router.post('/link-guest', async (req, res) => {
  if (authUnavailable(res)) return;
  const userId = bearerUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Token inválido', code: 'unauthorized' });
    return;
  }
  const guestPlayerId = String(req.body?.guestPlayerId ?? '').trim();
  if (!guestPlayerId) {
    res.status(400).json({ error: 'guestPlayerId requerido', code: 'invalid_guest_id' });
    return;
  }
  await linkGuestToUser(userId, guestPlayerId);
  logger.info('guest linked', { userId, guestPlayerId });
  res.json({ ok: true });
});

router.get('/participations', async (req, res) => {
  if (authUnavailable(res)) return;
  const userId = bearerUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Token inválido', code: 'unauthorized' });
    return;
  }
  const items = await listParticipationsByUser(userId);
  res.json({
    participations: items.map((p) => ({
      roomId: p.roomId,
      playerName: p.playerName,
      role: p.role,
      team: p.team,
      won: p.won,
      isMvp: p.isMvp,
      finishedAt: p.finishedAt.toISOString(),
    })),
  });
});

/** Validación de token para otros microservicios (game-realtime). */
router.get('/verify', (req, res) => {
  if (authUnavailable(res)) return;
  const userId = bearerUserId(req);
  if (!userId) {
    res.status(401).json({ valid: false, code: 'unauthorized' });
    return;
  }
  res.json({ valid: true, userId });
});

export default router;
