/**
 * Utilidades JWT — access tokens para API y sockets.
 */
import * as crypto from 'crypto';
import { JWT_ACCESS_TTL_SEC, JWT_SECRET } from '../config/env';

export type AccessTokenPayload = {
	sub: string;
	username: string;
	email?: string;
};

export function isJwtConfigured(): boolean {
	return Boolean(JWT_SECRET);
}

export function signAccessToken(payload: AccessTokenPayload): string {
	if (!JWT_SECRET) throw new Error('JWT_SECRET no configurado');
	const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
	const now = Math.floor(Date.now() / 1000);
	const body = Buffer.from(
		JSON.stringify({ ...payload, iat: now, exp: now + JWT_ACCESS_TTL_SEC }),
	).toString('base64url');
	const signature = crypto
		.createHmac('sha256', JWT_SECRET)
		.update(`${header}.${body}`)
		.digest('base64url');
	return `${header}.${body}.${signature}`;
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
	if (!JWT_SECRET || !token?.trim()) return null;
	const parts = token.split('.');
	if (parts.length !== 3) return null;
	const [header, body, signature] = parts;
	const expected = crypto
		.createHmac('sha256', JWT_SECRET)
		.update(`${header}.${body}`)
		.digest('base64url');
	if (signature !== expected) return null;
	try {
		const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
		if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
			return null;
		}
		if (!payload.sub || !payload.username) return null;
		return {
			sub: String(payload.sub),
			username: String(payload.username),
			email: payload.email ? String(payload.email) : undefined,
		};
	} catch {
		return null;
	}
}

export function hashToken(raw: string): string {
	return crypto.createHmac('sha256', JWT_SECRET || 'fallback').update(raw).digest('hex');
}

export function newRefreshToken(): string {
	return crypto.randomBytes(48).toString('base64url');
}
