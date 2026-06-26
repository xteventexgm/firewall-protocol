/**
 * Tokens de un solo uso para verificación de correo y recuperación de contraseña.
 */
import * as crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { hashToken } from '../auth/jwt';
import { getDb } from './mongoConnection';

export type EmailTokenType = 'verify_email' | 'reset_password' | 'delete_account';

export type EmailTokenDocument = {
  _id: ObjectId;
  userId: ObjectId;
  type: EmailTokenType;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  usedAt?: Date;
};

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const DELETE_TTL_MS = 60 * 60 * 1000;

function tokens() {
  return getDb().collection<EmailTokenDocument>('email_tokens');
}

export function newEmailToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createEmailToken(
  userId: string,
  type: EmailTokenType,
): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = newEmailToken();
  const now = new Date();
  const ttl =
    type === 'verify_email' ? VERIFY_TTL_MS : type === 'delete_account' ? DELETE_TTL_MS : RESET_TTL_MS;
  const expiresAt = new Date(now.getTime() + ttl);
  await tokens().insertOne({
    _id: new ObjectId(),
    userId: new ObjectId(userId),
    type,
    tokenHash: hashToken(rawToken),
    expiresAt,
    createdAt: now,
  });
  return { rawToken, expiresAt };
}

export async function consumeEmailToken(
  rawToken: string,
  type: EmailTokenType,
): Promise<string | null> {
  const trimmed = rawToken.trim();
  if (!trimmed) return null;
  const doc = await tokens().findOne({
    tokenHash: hashToken(trimmed),
    type,
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });
  if (!doc) return null;
  await tokens().updateOne({ _id: doc._id }, { $set: { usedAt: new Date() } });
  return doc.userId.toHexString();
}

export async function deleteEmailTokensForUser(userId: string): Promise<void> {
  if (!ObjectId.isValid(userId)) return;
  await tokens().deleteMany({ userId: new ObjectId(userId) });
}
