/**
 * Cliente HTTP hacia el servicio identity (sin MongoDB en media).
 */
import { IDENTITY_URL, INTERNAL_SERVICE_KEY } from '../config/env';

export type IdentityPublicUser = {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  preferredLocale?: string;
  stats?: {
    gamesPlayed: number;
    mvpCount: number;
    winsByTeam: Record<string, number>;
    favoriteRoles: string[];
  };
  linkedGuestIds?: string[];
  createdAt?: string;
  lastLoginAt?: string;
};

export async function verifyBearerToken(authorization: string): Promise<string | null> {
  const res = await fetch(`${IDENTITY_URL}/api/auth/verify`, {
    headers: { Authorization: authorization },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { valid?: boolean; userId?: string };
  return body.valid && body.userId ? body.userId : null;
}

export async function patchUserAvatarUrl(
  userId: string,
  avatarUrl: string | null,
  authorization?: string,
): Promise<{ ok: boolean; user: IdentityPublicUser | null }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authorization) headers.Authorization = authorization;
  if (INTERNAL_SERVICE_KEY) {
    headers['X-Internal-Service'] = 'media';
    headers['X-Internal-Service-Key'] = INTERNAL_SERVICE_KEY;
  }

  const res = await fetch(`${IDENTITY_URL}/api/auth/users/${userId}/avatar`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ avatarUrl }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    user?: IdentityPublicUser;
    error?: string;
    code?: string;
  };

  if (!res.ok) {
    throw new Error(data.code || data.error || 'identity_avatar_update_failed');
  }

  return { ok: Boolean(data.ok ?? true), user: data.user ?? null };
}

export async function getPublicUser(
  userId: string,
  authorization?: string,
): Promise<IdentityPublicUser | null> {
  const headers: Record<string, string> = {};
  if (authorization) headers.Authorization = authorization;
  const res = await fetch(`${IDENTITY_URL}/api/auth/users/${userId}`, { headers });
  if (!res.ok) return null;
  const data = (await res.json()) as { user?: IdentityPublicUser };
  return data.user ?? null;
}