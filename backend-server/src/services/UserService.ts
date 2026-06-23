/**
 * Colección `users` — cuentas de jugador (DATABASE.md §10.1).
 */
import { ObjectId } from 'mongodb';
import { getDb } from './mongoConnection';
import { hashPassword, verifyPassword } from '../auth/password';
import { validatePassword, validateUsername } from '../auth/passwordPolicy';

export type AuthProvider = 'local' | 'google' | 'guest_linked';

export type UserDocument = {
	_id: ObjectId;
	email?: string;
	username: string;
	passwordHash?: string;
	authProvider: AuthProvider;
	avatarUrl?: string;
	preferredLocale?: string;
	stats: {
		gamesPlayed: number;
		winsByTeam: Record<string, number>;
		mvpCount: number;
		favoriteRoles: string[];
	};
	linkedGuestIds: string[];
	createdAt: Date;
	lastLoginAt?: Date;
	isActive: boolean;
};

export type PublicUser = {
	id: string;
	email?: string;
	username: string;
	authProvider: AuthProvider;
	avatarUrl?: string;
	preferredLocale?: string;
	stats: UserDocument['stats'];
	linkedGuestIds: string[];
	createdAt: string;
	lastLoginAt?: string;
	isActive: boolean;
};

function toPublicUser(doc: UserDocument): PublicUser {
	return {
		id: doc._id.toHexString(),
		email: doc.email,
		username: doc.username,
		authProvider: doc.authProvider,
		avatarUrl: doc.avatarUrl,
		preferredLocale: doc.preferredLocale,
		stats: doc.stats,
		linkedGuestIds: doc.linkedGuestIds ?? [],
		createdAt: doc.createdAt.toISOString(),
		lastLoginAt: doc.lastLoginAt?.toISOString(),
		isActive: doc.isActive,
	};
}

function users() {
	return getDb().collection<UserDocument>('users');
}

export async function registerUser(input: {
	email?: string;
	username: string;
	password: string;
	preferredLocale?: string;
}): Promise<PublicUser> {
	const username = input.username.trim();
	const email = input.email?.trim().toLowerCase();
	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('email_required');
	const userErr = validateUsername(username);
	if (userErr) throw new Error(userErr);
	const pwdErr = validatePassword(input.password);
	if (pwdErr) throw new Error(pwdErr);

	const existing = await users().findOne({
		$or: [{ username }, { email }],
	});
	if (existing) throw new Error(existing.username === username ? 'username_taken' : 'email_taken');

	const now = new Date();
	const doc: UserDocument = {
		_id: new ObjectId(),
		email,
		username,
		passwordHash: hashPassword(input.password),
		authProvider: 'local',
		preferredLocale: input.preferredLocale || 'es',
		stats: { gamesPlayed: 0, winsByTeam: {}, mvpCount: 0, favoriteRoles: [] },
		linkedGuestIds: [],
		createdAt: now,
		isActive: true,
	};
	await users().insertOne(doc);
	return toPublicUser(doc);
}

export async function loginUser(email: string, password: string): Promise<UserDocument> {
	const key = email.trim().toLowerCase();
	if (!key || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) throw new Error('email_required');
	const doc = await users().findOne({ isActive: true, email: key });
	if (!doc?.passwordHash || !verifyPassword(password, doc.passwordHash)) {
		throw new Error('invalid_credentials');
	}
	await users().updateOne({ _id: doc._id }, { $set: { lastLoginAt: new Date() } });
	doc.lastLoginAt = new Date();
	return doc;
}

export async function findUserById(userId: string): Promise<UserDocument | null> {
	if (!ObjectId.isValid(userId)) return null;
	return users().findOne({ _id: new ObjectId(userId), isActive: true });
}

export async function getPublicUser(userId: string): Promise<PublicUser | null> {
	const doc = await findUserById(userId);
	return doc ? toPublicUser(doc) : null;
}

export async function linkGuestToUser(userId: string, guestPlayerId: string): Promise<void> {
	if (!ObjectId.isValid(userId)) throw new Error('invalid_user');
	await users().updateOne(
		{ _id: new ObjectId(userId) },
		{ $addToSet: { linkedGuestIds: guestPlayerId } },
	);
}

export async function changeUsername(
	userId: string,
	currentPassword: string,
	newUsername: string,
): Promise<PublicUser> {
	const nameErr = validateUsername(newUsername);
	if (nameErr) throw new Error(nameErr);
	if (!ObjectId.isValid(userId)) throw new Error('invalid_user');
	const doc = await users().findOne({ _id: new ObjectId(userId), isActive: true });
	if (!doc?.passwordHash || !verifyPassword(currentPassword, doc.passwordHash)) {
		throw new Error('invalid_current_password');
	}
	const trimmed = newUsername.trim();
	const taken = await users().findOne({ username: trimmed, _id: { $ne: doc._id } });
	if (taken) throw new Error('username_taken');
	await users().updateOne({ _id: doc._id }, { $set: { username: trimmed } });
	return toPublicUser({ ...doc, username: trimmed });
}

export async function changeUserPassword(
	userId: string,
	currentPassword: string,
	newPassword: string,
): Promise<void> {
	const pwdErr = validatePassword(newPassword);
	if (pwdErr) throw new Error(pwdErr);
	if (!ObjectId.isValid(userId)) throw new Error('invalid_user');
	const doc = await users().findOne({ _id: new ObjectId(userId), isActive: true });
	if (!doc?.passwordHash || !verifyPassword(currentPassword, doc.passwordHash)) {
		throw new Error('invalid_current_password');
	}
	await users().updateOne(
		{ _id: doc._id },
		{ $set: { passwordHash: hashPassword(newPassword) } },
	);
}

export { toPublicUser };
