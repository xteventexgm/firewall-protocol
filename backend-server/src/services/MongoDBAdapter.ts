import { Collection, Db, Document, MongoClient } from 'mongodb';
import type { DBAdapter, ActiveRoomStatus } from '../config/database.types';
import type { GameArchiveCategory } from './dbSyncService';
import { buildSessionLogText } from './GameSessionLogService';
import { logger } from '../utils/logger';

type GameDocument = Document & {
  _id: string;
  roomId: string;
  archiveCategory: 'active' | GameArchiveCategory;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
};

type SessionLogDocument = Document & {
  roomId: string;
  text: string;
  archivedAt: Date;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Removes fields that only make sense while a socket is connected to this process. */
export function prepareGameDocument(roomId: string, state: any): Record<string, any> {
  const copy = clone(state ?? {});
  delete copy._id;
  copy.roomId = roomId;
  if (Array.isArray(copy.players)) {
    copy.players = copy.players.map((player: Record<string, unknown>) => {
      const { socketId: _socketId, lastDisconnectReason: _reason, ...persisted } = player;
      return persisted;
    });
  }
  return copy;
}

export function statusFromGame(data: any | null, playerId?: string): ActiveRoomStatus {
  if (!data) {
    return { exists: false, phase: null, playerCount: 0, connectedCount: 0, canJoin: false, canReconnect: false };
  }
  const phase = data.phase ?? null;
  const players = Array.isArray(data.players) ? data.players : [];
  const inProgress = phase && phase !== 'LOBBY' && phase !== 'FIN';
  const playerKnown = !playerId || players.some((player: { id?: string }) => player.id === playerId);
  return {
    exists: true,
    phase,
    playerCount: players.length,
    connectedCount: players.filter((player: { isConnected?: boolean }) => player.isConnected !== false).length,
    canJoin: phase === 'LOBBY',
    canReconnect: Boolean(inProgress && playerKnown),
  };
}

/**
 * MongoDB-backed adapter with a synchronous read-through cache.
 *
 * The game engine intentionally uses a synchronous persistence contract. Active and
 * finished games are loaded before the server starts, while mutations are serialized
 * through one promise chain so save -> archive ordering is preserved.
 */
export class MongoDBAdapter implements DBAdapter {
  private readonly client: MongoClient;
  private db?: Db;
  private games?: Collection<GameDocument>;
  private sessionLogs?: Collection<SessionLogDocument>;
  private readonly cache = new Map<string, any>();
  private readonly logCache = new Map<string, string>();
  private writes: Promise<void> = Promise.resolve();
  private initialized = false;

  constructor(uri: string, private readonly databaseName = 'firewall_protocol') {
    this.client = new MongoClient(uri);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.client.connect();
    this.db = this.client.db(this.databaseName);
    this.games = this.db.collection<GameDocument>('games');
    this.sessionLogs = this.db.collection<SessionLogDocument>('session_logs');

    await Promise.all([
      this.games.createIndex({ roomId: 1 }, { unique: true }),
      this.games.createIndex({ archiveCategory: 1, updatedAt: -1 }),
      this.games.createIndex({ phase: 1, archiveCategory: 1 }),
      this.games.createIndex({ 'players.id': 1 }, { sparse: true }),
      this.db.collection('roles').createIndex({ team: 1 }),
      this.db.collection('roles').createIndex({ locale: 1, version: 1 }),
      this.sessionLogs.createIndex({ roomId: 1 }, { unique: true }),
      this.sessionLogs.createIndex({ archivedAt: -1 }),
    ]);

    const [games, logs] = await Promise.all([
      this.games.find({ archiveCategory: { $in: ['active', 'finishgame'] } }).toArray(),
      this.sessionLogs.find({}).toArray(),
    ]);
    for (const game of games) this.cache.set(game.roomId, this.withoutMongoId(game));
    for (const log of logs) this.logCache.set(log.roomId, log.text);
    this.initialized = true;
    logger.info('[db] MongoDB ready', { database: this.databaseName, games: games.length, sessionLogs: logs.length });
  }

  private withoutMongoId(document: GameDocument): any {
    const { _id: _id, ...state } = document;
    return clone(state);
  }

  private enqueue(label: string, operation: () => Promise<unknown>): void {
    this.writes = this.writes.then(async () => {
      try {
        await operation();
      } catch (error: any) {
        logger.error(`[db] MongoDB ${label} failed`, error?.message ?? error);
      }
    });
  }

  private requireCollections(): { games: Collection<GameDocument>; logs: Collection<SessionLogDocument> } {
    if (!this.games || !this.sessionLogs) throw new Error('MongoDB adapter has not been initialized');
    return { games: this.games, logs: this.sessionLogs };
  }

  save(roomId: string, state: any): boolean {
    const { games } = this.requireCollections();
    const now = new Date();
    const payload = prepareGameDocument(roomId, state);
    const existing = this.cache.get(roomId);
    const cached = { ...payload, archiveCategory: 'active', createdAt: existing?.createdAt ?? now, updatedAt: now };
    this.cache.set(roomId, cached);
    this.enqueue('save', () => games.updateOne(
      { _id: roomId },
      {
        $set: { ...payload, archiveCategory: 'active', updatedAt: now },
        $setOnInsert: { _id: roomId, createdAt: now },
        $unset: { archivedAt: '' },
      },
      { upsert: true },
    ));
    return true;
  }

  load(roomId: string): any | null {
    const game = this.cache.get(roomId);
    return game?.archiveCategory === 'active' ? clone(game) : null;
  }

  loadOrArchive(roomId: string): any | null {
    const game = this.cache.get(roomId);
    return game && (game.archiveCategory === 'active' || game.archiveCategory === 'finishgame') ? clone(game) : null;
  }

  readSessionLog(roomId: string): string | null {
    return this.logCache.get(roomId) ?? null;
  }

  delete(roomId: string): boolean {
    return this.archive(roomId, 'deletegame', { reason: 'deleted' });
  }

  archive(roomId: string, category: GameArchiveCategory, extra: Record<string, unknown> = {}): boolean {
    const current = this.load(roomId);
    if (!current) return false;
    const { games, logs } = this.requireCollections();
    const now = new Date();
    const archived = { ...current, ...extra, archiveCategory: category, archivedAt: now, updatedAt: now };
    this.cache.set(roomId, archived);
    if (category === 'deletegame') this.cache.delete(roomId);

    let logText: string | undefined;
    if (category === 'finishgame') {
      logText = buildSessionLogText(archived);
      this.logCache.set(roomId, logText);
    }

    this.enqueue('archive', async () => {
      await games.updateOne(
        { _id: roomId, archiveCategory: 'active' },
        { $set: { ...extra, archiveCategory: category, archivedAt: now, updatedAt: now } },
      );
      if (logText) {
        await logs.updateOne(
          { roomId },
          { $set: { text: logText, archivedAt: now, winner: archived.winner ?? null, soloWinner: archived.soloWinner ?? null } },
          { upsert: true },
        );
      }
    });
    return true;
  }

  list(): string[] {
    return [...this.cache.entries()]
      .filter(([, game]) => game.archiveCategory === 'active')
      .map(([roomId]) => roomId)
      .sort();
  }

  getStatus(roomId: string, playerId?: string): ActiveRoomStatus {
    return statusFromGame(this.load(roomId), playerId);
  }

  async close(): Promise<void> {
    await this.writes;
    await this.client.close();
    this.initialized = false;
  }
}
