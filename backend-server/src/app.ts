/**
 * Aplicación Express del backend.
 */
import express from 'express';
import bodyParser from 'body-parser';
import { isJwtConfigured } from './auth/jwt';
import database, { getPersistenceMode } from './config/database';
import authRoutes from './routes/auth.routes';
import { isMongoConnected, isMongoEnabled, getMongoLastError } from './services/mongoConnection';
import { getAvatarStorageMode } from './services/AvatarService';
import {
	ensureObjectStorageBucket,
	getObjectStorageLastError,
	getObjectStorageProvider,
	isObjectStorageConnected,
	isObjectStorageEnabled,
} from './services/objectStorageClient';
import { S3_BUCKET, S3_ENDPOINT } from './config/env';
import { isValidRoomCode, normalizeRoomCode } from './utils/socketErrors';

const app = express();

app.use((req, res, next) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
	res.setHeader(
		'Access-Control-Allow-Headers',
		'Content-Type, Authorization, ngrok-skip-browser-warning, Bypass-Tunnel-Reminder',
	);
	res.setHeader('Access-Control-Max-Age', '86400');
	if (req.method === 'OPTIONS') {
		res.sendStatus(204);
		return;
	}
	next();
});

app.use(bodyParser.json());
app.use('/api/auth', authRoutes);

app.get('/health', (_req, res) => {
	const persistence = getPersistenceMode();
	res.json({
		status: 'ok',
		ts: new Date().toISOString(),
		persistence,
		mongodb: {
			configured: isMongoEnabled(),
			connected: isMongoConnected(),
			error: isMongoEnabled() && !isMongoConnected() ? getMongoLastError() : null,
		},
		auth: {
			enabled: isMongoEnabled() && isJwtConfigured(),
			guestPlayAllowed: true,
		},
		avatars: {
			storage: getAvatarStorageMode(),
			objectStorage: isObjectStorageEnabled()
				? {
						provider: getObjectStorageProvider(),
						configured: true,
						connected: isObjectStorageConnected(),
						endpoint: S3_ENDPOINT,
						bucket: S3_BUCKET,
						error: !isObjectStorageConnected() ? getObjectStorageLastError() : null,
					}
				: { configured: false },
		},
	});
});

app.get('/', (_req, res) => {
	res.send('Firewall Protocol backend running');
});

app.get('/api/games', (_req, res) => {
	const games = database.list().map((roomId) => {
		const data = database.load(roomId);
		return {
			roomId,
			phase: data?.phase ?? null,
			playerCount: data?.players?.length ?? 0,
			winner: data?.winner ?? null,
			savedAt: data?.phaseStartedAt ?? null,
		};
	});
	res.json({ games });
});

/** Catálogo de roles desde MongoDB (P1). Fallback: array vacío sin Mongo. */
app.get('/api/roles', async (_req, res) => {
	if (!isMongoConnected()) {
		res.json({ roles: [], source: 'code', message: 'MongoDB no conectado — el juego usa roles.types.ts' });
		return;
	}
	try {
		const { getDb } = await import('./services/mongoConnection');
		const roles = await getDb()
			.collection('roles')
			.find({})
			.project({ _id: 1, team: 1, displayName: 1, description: 1, playerGuide: 1, nightActions: 1, victoryHint: 1 })
			.toArray();
		res.json({ roles, source: 'mongodb', count: roles.length });
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		res.status(500).json({ error: msg, code: 'roles_fetch_failed' });
	}
});

app.get('/api/games/:roomId/replay', async (req, res) => {
	const code = normalizeRoomCode(req.params.roomId);
	if (!isValidRoomCode(code)) {
		res.status(400).json({ error: 'Código inválido (invalid_room_code)' });
		return;
	}
	const data = await database.loadOrArchiveAsync(code);
	if (!data) {
		res.status(404).json({ error: 'Sala no encontrada (room_not_found)' });
		return;
	}
	res.setHeader('Content-Type', 'application/json');
	res.setHeader('Content-Disposition', `attachment; filename="${code}-replay.json"`);
	res.json({
		exportedAt: new Date().toISOString(),
		roomId: code,
		...data,
	});
});

app.get('/api/games/:roomId/session-log', async (req, res) => {
	const code = normalizeRoomCode(req.params.roomId);
	if (!isValidRoomCode(code)) {
		res.status(400).json({ error: 'Código inválido (invalid_room_code)' });
		return;
	}
	const logText = await database.readSessionLogAsync(code);
	if (!logText) {
		res.status(404).json({
			error: 'Registro no encontrado — la partida debe estar archivada como finishgame (session_log_not_found)',
		});
		return;
	}
	res.setHeader('Content-Type', 'text/plain; charset=utf-8');
	res.setHeader('Content-Disposition', `attachment; filename="${code}.log"`);
	res.send(logText);
});

app.get('/api/games/:roomId/status', (req, res) => {
	const code = normalizeRoomCode(req.params.roomId);
	if (!isValidRoomCode(code)) {
		res.status(400).json({ error: 'invalid_room_code' });
		return;
	}
	const playerId = typeof req.query.playerId === 'string' ? req.query.playerId : undefined;
	res.json(database.getStatus(code, playerId));
});

export default app;
