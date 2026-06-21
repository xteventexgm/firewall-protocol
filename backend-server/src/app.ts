/**
 * Aplicación Express mínima del backend.
 * Expone `/health` (monitorización) y `/` (confirmación de servicio).
 * La lógica realtime vive en Socket.io (`server.ts` → `sockets/`).
 */
import express from 'express';
import bodyParser from 'body-parser';
import database from './config/database';
import { isValidRoomCode, normalizeRoomCode } from './utils/socketErrors';

const app = express();

/** CORS para API REST (móvil/web en otro origen, p. ej. localhost + ngrok). */
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

app.get('/health', (req: express.Request, res: express.Response) => {
	res.json({ status: 'ok', ts: new Date().toISOString() });
});

app.get('/', (req: express.Request, res: express.Response) => {
	res.send('Firewall Protocol backend running');
});

/** Lista partidas guardadas en disco (JSON). */
app.get('/api/games', (_req: express.Request, res: express.Response) => {
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

/** Exporta snapshot JSON de una partida (replay / análisis post-partida). */
app.get('/api/games/:roomId/replay', (req: express.Request, res: express.Response) => {
	const code = normalizeRoomCode(req.params.roomId);
	if (!isValidRoomCode(code)) {
		res.status(400).json({ error: 'Código inválido (invalid_room_code)' });
		return;
	}
	const data = database.load(code);
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

/** Estado de sala activa para login/reconnect (no incluye finishgame/deletegame). */
app.get('/api/games/:roomId/status', (req: express.Request, res: express.Response) => {
	const code = normalizeRoomCode(req.params.roomId);
	if (!isValidRoomCode(code)) {
		res.status(400).json({ error: 'invalid_room_code' });
		return;
	}
	const playerId = typeof req.query.playerId === 'string' ? req.query.playerId : undefined;
	res.json(database.getStatus(code, playerId));
});

export default app;
