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
  findUserByEmail,
  findUserById,
  getPublicUser,
  isEmailVerified,
  linkGuestToUser,
  loginUser,
  markEmailVerified,
  registerUser,
  resetUserPassword,
  toPublicUser,
  updateUserAvatarUrl,
  type PublicUser,
} from '../services/UserService';
import { createEmailToken, consumeEmailToken } from '../services/EmailTokenService';
import {
  isEmailConfigured,
  sendDeleteAccountEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from '../services/EmailService';
import { confirmAccountDeletion } from '../services/AccountDeletionService';
import {
  getPublicAppBaseUrl,
  MEDIA_PUBLIC_URL,
  INTERNAL_SERVICE_KEY,
  REQUIRE_EMAIL_VERIFICATION,
} from '../config/env';
import {
  buildVerifyErrorPageHtml,
  buildVerifySuccessPageHtml,
} from '../emails/emailTemplates';
import { resolveBrandIconPath } from '../utils/brandAssets';
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
    emailConfigured: isEmailConfigured(),
    requireEmailVerification: REQUIRE_EMAIL_VERIFICATION,
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

    void (async () => {
      try {
        const { rawToken } = await createEmailToken(user.id, 'verify_email');
        if (user.email) await sendVerificationEmail(user.email, user.username, rawToken);
      } catch (err) {
        logger.error('verification email failed', err);
      }
    })();

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

router.post('/forgot-password', async (req, res) => {
  if (authUnavailable(res)) return;
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Correo inválido', code: 'email_required' });
    return;
  }
  const doc = await findUserByEmail(email);
  if (doc?.email && doc.passwordHash) {
    try {
      const { rawToken } = await createEmailToken(doc._id.toHexString(), 'reset_password');
      await sendPasswordResetEmail(doc.email, doc.username, rawToken);
    } catch (err) {
      logger.error('password reset email failed', err);
    }
  }
  res.json({
    ok: true,
    message: 'Si el correo está registrado, recibirás instrucciones para restablecer la contraseña.',
  });
});

router.post('/reset-password', async (req, res) => {
  if (authUnavailable(res)) return;
  const token = String(req.body?.token ?? '').trim();
  const newPassword = String(req.body?.newPassword ?? '');
  if (!token || !newPassword) {
    res.status(400).json({ error: 'Token y contraseña requeridos', code: 'reset_required' });
    return;
  }
  try {
    const userId = await consumeEmailToken(token, 'reset_password');
    if (!userId) {
      res.status(400).json({ error: 'Código inválido o expirado', code: 'invalid_reset_token' });
      return;
    }
    await resetUserPassword(userId, newPassword);
    res.json({ ok: true });
  } catch (err: unknown) {
    const code = err instanceof Error ? err.message : 'password_reset_failed';
    res.status(400).json({ error: code, code });
  }
});

async function verifyEmailToken(rawToken: string): Promise<PublicUser | null> {
  const userId = await consumeEmailToken(rawToken, 'verify_email');
  if (!userId) return null;
  await markEmailVerified(userId);
  return getPublicUser(userId);
}

const publicBase = () => getPublicAppBaseUrl();

router.get('/brand/icon.png', (_req, res) => {
  const iconPath = resolveBrandIconPath();
  if (!iconPath) {
    res.status(404).end();
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.type('png').sendFile(iconPath);
});

router.get('/verify-email', async (req, res) => {
  if (authUnavailable(res)) return;
  const base = publicBase();
  const token = String(req.query.token ?? '').trim();
  if (!token) {
    res.status(400).type('html').send(buildVerifyErrorPageHtml('Enlace inválido.', base));
    return;
  }
  const user = await verifyEmailToken(token);
  if (!user) {
    res.status(400).type('html').send(buildVerifyErrorPageHtml('Enlace inválido o expirado.', base));
    return;
  }
  res.type('html').send(buildVerifySuccessPageHtml(user.username, base));
});

router.post('/verify-email', async (req, res) => {
  if (authUnavailable(res)) return;
  const token = String(req.body?.token ?? '').trim();
  if (!token) {
    res.status(400).json({ error: 'Código requerido', code: 'token_required' });
    return;
  }
  const user = await verifyEmailToken(token);
  if (!user) {
    res.status(400).json({ error: 'Código inválido o expirado', code: 'invalid_verify_token' });
    return;
  }
  res.json({ ok: true, user: enrichAvatarUrl(user) });
});

router.post('/resend-verification', async (req, res) => {
  if (authUnavailable(res)) return;
  const userId = bearerUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Token inválido', code: 'unauthorized' });
    return;
  }
  const doc = await findUserById(userId);
  if (!doc?.email) {
    res.status(400).json({ error: 'Sin correo en la cuenta', code: 'email_missing' });
    return;
  }
  if (isEmailVerified(doc)) {
    res.json({ ok: true, alreadyVerified: true });
    return;
  }
  try {
    const { rawToken } = await createEmailToken(userId, 'verify_email');
    await sendVerificationEmail(doc.email, doc.username, rawToken);
    res.json({ ok: true });
  } catch (err) {
    logger.error('resend verification failed', err);
    res.status(500).json({ error: 'No se pudo enviar el correo', code: 'email_send_failed' });
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

router.post('/request-delete-account', async (req, res) => {
  if (authUnavailable(res)) return;
  const userId = bearerUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Token inválido', code: 'unauthorized' });
    return;
  }
  const doc = await findUserById(userId);
  if (!doc?.email) {
    res.status(400).json({ error: 'Sin correo en la cuenta', code: 'email_missing' });
    return;
  }
  if (doc.authProvider !== 'local' || !doc.passwordHash) {
    res.status(400).json({ error: 'Tipo de cuenta no compatible', code: 'delete_not_supported' });
    return;
  }
  try {
    const { rawToken } = await createEmailToken(userId, 'delete_account');
    await sendDeleteAccountEmail(doc.email, doc.username, rawToken);
    res.json({ ok: true, message: 'Código enviado a tu correo.' });
  } catch (err) {
    logger.error('delete account email failed', err);
    res.status(500).json({ error: 'No se pudo enviar el correo', code: 'email_send_failed' });
  }
});

router.post('/confirm-delete-account', async (req, res) => {
  if (authUnavailable(res)) return;
  const userId = bearerUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Token inválido', code: 'unauthorized' });
    return;
  }
  const token = String(req.body?.token ?? '').trim();
  const password = String(req.body?.password ?? '');
  if (!token || !password) {
    res.status(400).json({ error: 'Código y contraseña requeridos', code: 'delete_confirm_required' });
    return;
  }
  try {
    await confirmAccountDeletion(userId, password, token);
    res.json({ ok: true });
  } catch (err: unknown) {
    const code = err instanceof Error ? err.message : 'delete_account_failed';
    const status =
      code === 'invalid_current_password'
        ? 401
        : code === 'invalid_delete_token'
          ? 400
          : 400;
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
