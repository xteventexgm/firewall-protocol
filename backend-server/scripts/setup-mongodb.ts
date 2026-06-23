import 'dotenv/config';
import { Db, MongoClient } from 'mongodb';
import { MONGO_DB_NAME, MONGO_URI } from '../src/config/env';
import { seedRoles } from './seed-roles';

async function ensureCollection(db: Db, name: string): Promise<void> {
	const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
	if (!exists) await db.createCollection(name);
}

async function createIndexes(db: Db): Promise<void> {
	const games = db.collection('games');
	const roles = db.collection('roles');
	const sessionLogs = db.collection('session_logs');
	const users = db.collection('users');
	const authSessions = db.collection('auth_sessions');
	const participations = db.collection('game_participations');

	await Promise.all([
		games.createIndex({ roomId: 1 }, { unique: true }),
		games.createIndex({ archiveCategory: 1, updatedAt: -1 }),
		games.createIndex({ phase: 1, archiveCategory: 1 }),
		games.createIndex({ 'players.id': 1 }, { sparse: true }),
		games.createIndex({ 'players.userId': 1 }, { sparse: true }),
		roles.createIndex({ team: 1 }),
		roles.createIndex({ locale: 1, version: 1 }),
		sessionLogs.createIndex({ roomId: 1 }, { unique: true }),
		sessionLogs.createIndex({ archivedAt: -1 }),
		users.createIndex({ username: 1 }, { unique: true }),
		users.createIndex({ email: 1 }, { unique: true, sparse: true }),
		authSessions.createIndex({ refreshTokenHash: 1 }),
		authSessions.createIndex({ userId: 1 }),
		authSessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
		participations.createIndex({ userId: 1, finishedAt: -1 }),
		participations.createIndex({ guestPlayerId: 1, finishedAt: -1 }),
		participations.createIndex({ roomId: 1 }),
	]);
}

async function main(): Promise<void> {
	if (!MONGO_URI) throw new Error('MONGO_URI is required');
	const client = new MongoClient(MONGO_URI);
	await client.connect();
	try {
		const db = client.db(MONGO_DB_NAME);
		await Promise.all([
			ensureCollection(db, 'games'),
			ensureCollection(db, 'roles'),
			ensureCollection(db, 'session_logs'),
			ensureCollection(db, 'users'),
			ensureCollection(db, 'auth_sessions'),
			ensureCollection(db, 'game_participations'),
		]);
		await createIndexes(db);
		const roleCount = await seedRoles(db);
		console.log(
			`MongoDB setup complete for ${MONGO_DB_NAME}: 6 collections, indexes ready, ${roleCount} roles seeded.`,
		);
	} finally {
		await client.close();
	}
}

void main().catch((error) => {
	console.error(error?.message ?? error);
	process.exitCode = 1;
});
