/**
 * Implementación MongoDB de `DBAdapter`.
 *
 * - Partidas activas en caché en memoria (lecturas síncronas para `Room` / `RoomManager`).
 * - Escrituras encoladas de forma asíncrona hacia la colección `games`.
 * - Archivado en `finishgame` / `deletegame` + `session_logs` según DATABASE.md.
 */
import { GameArchiveCategory } from './dbSyncService';
import { buildSessionLogText } from './GameSessionLogService';
import {
	incrementUserStatsAfterGame,
	recordGameParticipations,
} from './GameParticipationService';
import { getDb } from './mongoConnection';
import { logger } from '../utils/logger';
import type { ActiveRoomStatus, DBAdapter } from '../config/database';

type GameDocument = { _id: string; roomId: string; archiveCategory: string; [key: string]: unknown };

/** Omite campos de MongoDB y runtime antes de hidratar `GameStateModel`. */
export function documentToGameState(doc: Record<string, unknown>): Record<string, unknown> {
	const { _id, archiveCategory, archivedAt, createdAt, updatedAt, ...state } = doc;
	return state;
}

/** Prepara snapshot de partida para persistencia (sin socketId). */
export function prepareGameDocument(roomId: string, state: Record<string, unknown>): Record<string, unknown> {
	const id = roomId.trim().toUpperCase();
	const players = ((state.players as Array<Record<string, unknown>>) ?? []).map((player) => {
		const { socketId: _socketId, ...rest } = player;
		return rest;
	});
	return {
		...state,
		roomId: id,
		players,
	};
}

function normalizeId(roomId: string): string {
	return roomId.trim().toUpperCase();
}

function computeRoomStatus(data: Record<string, unknown> | null, playerId?: string): ActiveRoomStatus {
	if (!data) {
		return { exists: false, phase: null, playerCount: 0, connectedCount: 0, canJoin: false, canReconnect: false };
	}
	const phase = (data.phase as string) ?? null;
	const players = (data.players as Array<{ id: string; isConnected?: boolean }>) ?? [];
	const playerCount = players.length;
	const connectedCount = players.filter((p) => p.isConnected !== false).length;
	const canJoin = phase === 'LOBBY';
	const inProgress = Boolean(phase && phase !== 'LOBBY' && phase !== 'FIN');
	const playerKnown = !playerId || players.some((p) => p.id === playerId);
	const canReconnect = inProgress && playerKnown;
	return { exists: true, phase, playerCount, connectedCount, canJoin, canReconnect };
}

export function createMongoDBAdapter(): DBAdapter & { warmCache(): Promise<void> } {
	const activeCache = new Map<string, Record<string, unknown>>();
	let writeChain: Promise<void> = Promise.resolve();

	function enqueueWrite(label: string, roomId: string, fn: () => Promise<void>): void {
		writeChain = writeChain
			.then(fn)
			.catch((err: unknown) => {
				const msg = err instanceof Error ? err.message : String(err);
				logger.error(`[db:mongo] ${label} failed`, { roomId, error: msg });
			});
	}

	async function warmCache(): Promise<void> {
		const games = getDb().collection<GameDocument>('games');
		const docs = await games.find({ archiveCategory: 'active' }).toArray();
		activeCache.clear();
		for (const doc of docs) {
			activeCache.set(doc.roomId, documentToGameState(doc) as Record<string, unknown>);
		}
		logger.info('[db:mongo] cache warmed', { activeGames: activeCache.size });
	}

	return {
		warmCache,

		save(roomId: string, state: any): boolean {
			const id = normalizeId(roomId);
			const plain = prepareGameDocument(id, state);
			activeCache.set(id, plain);
			enqueueWrite('save', id, async () => {
				const now = new Date();
				await getDb().collection('games').updateOne(
					{ roomId: id },
					{
						$set: { ...plain, roomId: id, archiveCategory: 'active', updatedAt: now },
						$setOnInsert: { _id: id, createdAt: now },
						$unset: { archivedAt: '' },
					},
					{ upsert: true },
				);
			});
			logger.info('[db:mongo] save queued', {
				roomId: id,
				phase: plain.phase,
				players: Array.isArray(plain.players) ? plain.players.length : 0,
			});
			return true;
		},

		load(roomId: string) {
			const id = normalizeId(roomId);
			const data = activeCache.get(id) ?? null;
			if (data) {
				logger.info('[db:mongo] load OK (cache)', { roomId: id, phase: data.phase, players: (data.players as unknown[])?.length ?? 0 });
			}
			return data;
		},

		loadOrArchive(roomId: string) {
			const id = normalizeId(roomId);
			return activeCache.get(id) ?? null;
		},

		async loadOrArchiveAsync(roomId: string) {
			const id = normalizeId(roomId);
			const active = activeCache.get(id);
			if (active) return active;

			const doc = await getDb()
				.collection<GameDocument>('games')
				.findOne({ roomId: id, archiveCategory: 'finishgame' });
			return doc ? (documentToGameState(doc) as Record<string, unknown>) : null;
		},

		readSessionLog(_roomId: string) {
			return null;
		},

		async readSessionLogAsync(roomId: string) {
			const id = normalizeId(roomId);
			const doc = await getDb().collection<{ text?: string }>('session_logs').findOne({ roomId: id });
			return doc?.text ?? null;
		},

		delete(roomId: string): boolean {
			const id = normalizeId(roomId);
			activeCache.delete(id);
			enqueueWrite('delete', id, async () => {
				await getDb().collection('games').deleteOne({ roomId: id, archiveCategory: 'active' });
			});
			logger.info('[db:mongo] delete queued', { roomId: id });
			return true;
		},

		archive(roomId: string, category: GameArchiveCategory, extra?: Record<string, unknown>): boolean {
			const id = normalizeId(roomId);
			const cached = activeCache.get(id);
			activeCache.delete(id);

			enqueueWrite('archive', id, async () => {
				const games = getDb().collection<GameDocument>('games');
				const existing = await games.findOne({ roomId: id, archiveCategory: 'active' });
				const base = cached ?? (existing ? (documentToGameState(existing) as Record<string, unknown>) : {});
				const now = new Date();
				const merged = prepareGameDocument(id, { ...base, ...extra });
				const archivedAt = now;

				await games.updateOne(
					{ roomId: id },
					{
						$set: {
							...merged,
							roomId: id,
							archiveCategory: category,
							archivedAt,
							updatedAt: now,
						},
						$setOnInsert: { _id: id, createdAt: now },
					},
					{ upsert: true },
				);

				if (category === 'finishgame') {
					const logState = {
						...merged,
						roomId: id,
						archivedAt: archivedAt.toISOString(),
						archiveCategory: category,
					};
					const text = buildSessionLogText(logState);
					await getDb().collection('session_logs').updateOne(
						{ roomId: id },
						{
							$set: {
								roomId: id,
								text,
								archivedAt,
								winner: merged.winner ?? null,
								soloWinner: merged.soloWinner ?? null,
							},
						},
						{ upsert: true },
					);
					const count = await recordGameParticipations(id, merged);
					const players = (merged.players ?? []) as Array<{
						userId?: string;
						id: string;
						team?: string;
						role?: string;
						isAlive?: boolean;
						isBot?: boolean;
					}>;
					const mvpPlayerId = (merged.gameStats as { mvpPlayerId?: string } | undefined)?.mvpPlayerId;
					const winner = merged.winner as string | null | undefined;
					const soloWinner = merged.soloWinner as { playerId?: string } | null | undefined;
					for (const p of players) {
						if (!p.userId || p.isBot) continue;
						await incrementUserStatsAfterGame(p.userId, {
							won:
								soloWinner?.playerId === p.id ||
								(winner === 'system' && p.team === 'system' && p.isAlive !== false) ||
								(winner === 'black_hat' && p.team === 'black_hat' && p.isAlive !== false),
							isMvp: mvpPlayerId === p.id,
							role: p.role,
							team: p.team,
						});
					}
					logger.info('[db:mongo] participations recorded', { roomId: id, count });
				}
			});

			logger.info('[db:mongo] archive queued', { roomId: id, category });
			return true;
		},

		list(): string[] {
			return Array.from(activeCache.keys());
		},

		getStatus(roomId: string, playerId?: string): ActiveRoomStatus {
			const id = normalizeId(roomId);
			return computeRoomStatus(activeCache.get(id) ?? null, playerId);
		},
	};
}
