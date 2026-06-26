import { Db, MongoClient } from 'mongodb';
import { MONGO_DB_NAME, MONGO_URI } from '../config/env';
import { logger } from '../utils/logger';

let client: MongoClient | null = null;
let db: Db | null = null;
let lastError: string | null = null;
let connected = false;

export function isMongoEnabled(): boolean {
  return Boolean(MONGO_URI);
}

export function isMongoConnected(): boolean {
  return connected && db !== null;
}

export function getMongoLastError(): string | null {
  return lastError;
}

export async function connectMongo(): Promise<Db> {
  if (db) return db;
  if (!isMongoEnabled()) {
    throw new Error('MONGO_URI no está configurado');
  }

  const isAtlas = MONGO_URI.startsWith('mongodb+srv://');

  try {
    client = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: isAtlas ? 15_000 : 8_000,
      connectTimeoutMS: isAtlas ? 15_000 : 8_000,
    });
    await client.connect();
    await client.db(MONGO_DB_NAME).command({ ping: 1 });
    db = client.db(MONGO_DB_NAME);
    connected = true;
    lastError = null;
    logger.info('MongoDB connected', { database: MONGO_DB_NAME, provider: isAtlas ? 'atlas' : 'local' });
    return db;
  } catch (err: unknown) {
    connected = false;
    client = null;
    db = null;
    lastError = err instanceof Error ? err.message : String(err);
    throw err;
  }
}

export function getDb(): Db {
  if (!db) {
    throw new Error('MongoDB no conectado');
  }
  return db;
}

export async function closeMongo(): Promise<void> {
  if (client) await client.close();
  client = null;
  db = null;
  connected = false;
}
