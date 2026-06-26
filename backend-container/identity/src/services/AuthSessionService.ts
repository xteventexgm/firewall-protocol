import { ObjectId } from 'mongodb';
import { JWT_REFRESH_TTL_DAYS } from '../config/env';
import { hashToken, newRefreshToken } from '../auth/jwt';
import { getDb } from './mongoConnection';

export type AuthSessionDocument = {
  _id: ObjectId;
  userId: ObjectId;
  refreshTokenHash: string;
  deviceId?: string;
  expiresAt: Date;
  createdAt: Date;
};

function sessions() {
  return getDb().collection<AuthSessionDocument>('auth_sessions');
}

/** Etiqueta legible del dispositivo (p. ej. "Tecno Spark 20"). Máx. 120 caracteres. */
export function sanitizeDeviceLabel(raw?: unknown): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  const label = String(raw).trim().replace(/\s+/g, ' ');
  if (!label) return undefined;
  return label.slice(0, 120);
}

export async function createAuthSession(
  userId: string,
  deviceId?: string,
): Promise<{ refreshToken: string; expiresAt: Date }> {
  const refreshToken = newRefreshToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await sessions().insertOne({
    _id: new ObjectId(),
    userId: new ObjectId(userId),
    refreshTokenHash: hashToken(refreshToken),
    deviceId: sanitizeDeviceLabel(deviceId),
    expiresAt,
    createdAt: now,
  });
  return { refreshToken, expiresAt };
}

export async function rotateAuthSession(
  refreshToken: string,
): Promise<{ userId: string; newRefreshToken: string } | null> {
  const doc = await sessions().findOne({ refreshTokenHash: hashToken(refreshToken) });
  if (!doc || doc.expiresAt < new Date()) return null;
  await sessions().deleteOne({ _id: doc._id });
  const rotated = await createAuthSession(doc.userId.toHexString(), doc.deviceId);
  return { userId: doc.userId.toHexString(), newRefreshToken: rotated.refreshToken };
}

export async function revokeAuthSession(refreshToken: string): Promise<void> {
  await sessions().deleteOne({ refreshTokenHash: hashToken(refreshToken) });
}
