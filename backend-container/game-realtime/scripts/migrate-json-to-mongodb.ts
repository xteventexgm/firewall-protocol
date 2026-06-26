import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { MongoClient } from 'mongodb';
import { DATA_DIRECTORY, MONGO_DB_NAME, MONGO_URI } from '../src/config/env';
import { buildSessionLogText } from '../src/services/GameSessionLogService';
import { prepareGameDocument } from '../src/services/MongoDBAdapter';

type Category = 'active' | 'finishgame' | 'deletegame';
type MigratedGame = { _id: string; [key: string]: unknown };
type MigratedLog = { _id?: string; roomId: string; [key: string]: unknown };

async function main(): Promise<void> {
  if (!MONGO_URI) throw new Error('MONGO_URI is required');
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  try {
    const db = client.db(MONGO_DB_NAME);
    const games = db.collection<MigratedGame>('games');
    const logs = db.collection<MigratedLog>('session_logs');
    let migrated = 0;
    const sources: Array<[string, Category]> = [
      ['deletegame', 'deletegame'],
      ['finishgame', 'finishgame'],
      ['games', 'active'],
    ];
    for (const [directory, category] of sources) {
      const folder = path.join(DATA_DIRECTORY, directory);
      if (!fs.existsSync(folder)) continue;
      for (const filename of fs.readdirSync(folder).filter((name) => name.endsWith('.json'))) {
        const roomId = path.basename(filename, '.json').toUpperCase();
        const state = JSON.parse(fs.readFileSync(path.join(folder, filename), 'utf8'));
        const now = new Date();
        const payload = prepareGameDocument(roomId, state);
        const archivedAt = category === 'active' ? undefined : new Date(state.archivedAt ?? now);
        await games.updateOne(
          { _id: roomId },
          {
            $set: { ...payload, roomId, archiveCategory: category, updatedAt: now, ...(archivedAt ? { archivedAt } : {}) },
            $setOnInsert: { _id: roomId, createdAt: new Date(state.createdAt ?? now) },
            ...(category === 'active' ? { $unset: { archivedAt: '' } } : {}),
          },
          { upsert: true },
        );
        if (category === 'finishgame') {
          const logFile = path.join(folder, `${roomId}.log`);
          const text = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : buildSessionLogText({ ...payload, archivedAt });
          await logs.updateOne(
            { roomId },
            { $set: { roomId, text, archivedAt: archivedAt ?? now, winner: state.winner ?? null, soloWinner: state.soloWinner ?? null } },
            { upsert: true },
          );
        }
        migrated += 1;
      }
    }
    console.log(`Migrated ${migrated} game document(s) to ${MONGO_DB_NAME}`);
  } finally {
    await client.close();
  }
}

void main().catch((error) => {
  console.error(error?.message ?? error);
  process.exitCode = 1;
});
