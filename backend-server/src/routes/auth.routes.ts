/**
 * Rutas HTTP de autenticación y perfil (`/api/auth/*`).
 * Requiere MongoDB + JWT_SECRET. El juego guest sigue sin cuenta.
 */
import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { isJwtConfigured, signAccessToken, verifyAccessToken } from '../auth/jwt';
import { isMongoEnabled, getDb } from '../services/mongoConnection';
import {
	createAuthSession,
	revokeAuthSession,
	rotateAuthSession,
} from '../services/AuthSessionService';
import {
	findUserById,
	getPublicUser,
	linkGuestToUser,
	loginUser,
	registerUser,
	toPublicUser,
	changeUsername,
	changeUserPassword,
} from '../services/UserService';
import { listParticipationsByUser } from '../services/GameParticipationService';
import {
	AVATAR_MAX_BYTES,
	deleteAvatarFiles,
	resolveAvatarUrl,
	saveAvatarFile,
	serveAvatarFile,
} from '../services/AvatarService';
import { logger } from '../utils/logger';
import multer from 'multer';

const router = Router();

const avatarUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: AVATAR_MAX_BYTES },
	fileFilter: (_req, file, cb) => {
		const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
		if (ok) cb(null, true);
		else cb(new Error('invalid_image_type'));
	},
});

function enrichUserAvatar<T extends { id: string; avatarUrl?: string }>(user: T): T {
	return { ...user, avatarUrl: resolveAvatarUrl(user.id, user.avatarUrl) };
}

function authUnavailable(res: Response): boolean {
	if (!isMongoEnabled()) {
		res.status(503).json({
			error: 'Autenticación requiere MongoDB. Configura MONGO_URI y ejecuta npm run db:setup.',
			code: 'auth_requires_mongodb',
		});
		return true;
	}
	if (!isJwtConfigured()) {
		res.status(503).json({
			error: 'Autenticación deshabilitada: falta JWT_SECRET en .env',
			code: 'auth_requires_jwt_secret',
		});
		return true;
	}
	return false;
}

function bearerUserId(req: Request): string | null {
	const header = req.headers.authorization;
	if (!header?.startsWith('Bearer ')) return null;
	const payload = verifyAccessToken(header.slice(7));
	return payload?.sub ?? null;
}

router.get('/status', (_req, res) => {
	res.json({
		enabled: isMongoEnabled() && isJwtConfigured(),
		requiresMongo: true,
		requiresJwtSecret: true,
		guestPlayAllowed: true,
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
			user: enrichUserAvatar(user),
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
			user: enrichUserAvatar(user),
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
	res.json({ user, accessToken, refreshToken: rotated.newRefreshToken });
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
	res.json({ user });
});

/** Perfil completo: usuario + historial de partidas (DATABASE.md §10). */
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
		user: enrichUserAvatar(toPublicUser(doc)),
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

/** URL externa opcional de avatar. */
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
	if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) {
		res.status(400).json({ error: 'avatarUrl debe ser un enlace http(s)', code: 'invalid_avatar_url' });
		return;
	}
	if (avatarUrl) await deleteAvatarFiles(userId);
	await getDb()
		.collection('users')
		.updateOne(
			{ _id: new ObjectId(userId) },
			avatarUrl ? { $set: { avatarUrl } } : { $unset: { avatarUrl: '' } },
		);
	const user = await getPublicUser(userId);
	res.json({ user: user ? enrichUserAvatar(user) : null });
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
		res.json({ user: enrichUserAvatar(user) });
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

/** Sube foto de perfil (JPEG/PNG/WebP, máx. 2 MB). */
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
	if (authUnavailable(res)) return;
	const userId = bearerUserId(req);
	if (!userId) {
		res.status(401).json({ error: 'Token inválido', code: 'unauthorized' });
		return;
	}
	if (!req.file?.buffer) {
		res.status(400).json({ error: 'Archivo avatar requerido', code: 'avatar_required' });
		return;
	}
	try {
		const apiPath = await saveAvatarFile(userId, req.file.buffer, req.file.mimetype);
		await getDb().collection('users').updateOne({ _id: new ObjectId(userId) }, { $set: { avatarUrl: apiPath } });
		const user = await getPublicUser(userId);
		res.json({ user: user ? enrichUserAvatar(user) : null });
	} catch (err: unknown) {
		const code = err instanceof Error ? err.message : 'avatar_upload_failed';
		const status = code === 'avatar_too_large' ? 413 : 400;
		res.status(status).json({ error: code, code });
	}
});

/** Elimina foto subida o URL de avatar. */
router.delete('/avatar', async (req, res) => {
	if (authUnavailable(res)) return;
	const userId = bearerUserId(req);
	if (!userId) {
		res.status(401).json({ error: 'Token inválido', code: 'unauthorized' });
		return;
	}
	await deleteAvatarFiles(userId);
	await getDb().collection('users').updateOne({ _id: new ObjectId(userId) }, { $unset: { avatarUrl: '' } });
	const user = await getPublicUser(userId);
	res.json({ user: user ? enrichUserAvatar(user) : null });
});

/** Sirve avatar subido (público por userId; proxy desde disco o MinIO). */
router.get('/avatars/:userId', async (req, res) => {
	const userId = String(req.params.userId ?? '');
	if (!ObjectId.isValid(userId)) {
		res.status(404).end();
		return;
	}
	const served = await serveAvatarFile(userId, res);
	if (!served) res.status(404).end();
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
	logger.info('[auth] guest linked', { userId, guestPlayerId });
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

export default router;
