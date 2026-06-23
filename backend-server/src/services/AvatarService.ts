/**
 * Avatares de perfil en disco (`data/avatars/`).
 * Solo para la pantalla de cuenta — no se muestra en partida.
 */
import * as fs from 'fs';
import * as path from 'path';
import { DATA_DIRECTORY } from '../config/env';
import { logger } from '../utils/logger';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Map<string, string>([
	['image/jpeg', 'jpg'],
	['image/png', 'png'],
	['image/webp', 'webp'],
]);

const AVATAR_DIR = path.join(DATA_DIRECTORY, 'avatars');

function ensureDir(): void {
	if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

export function avatarApiPath(userId: string): string {
	return `/api/auth/avatars/${userId}`;
}

export function findAvatarFile(userId: string): { filePath: string; mime: string } | null {
	ensureDir();
	for (const [mime, ext] of ALLOWED_MIME.entries()) {
		const filePath = path.join(AVATAR_DIR, `${userId}.${ext}`);
		if (fs.existsSync(filePath)) return { filePath, mime };
	}
	return null;
}

export function hasUploadedAvatar(userId: string): boolean {
	return findAvatarFile(userId) !== null;
}

export function saveAvatarFile(userId: string, buffer: Buffer, mimeType: string): string {
	const ext = ALLOWED_MIME.get(mimeType);
	if (!ext) throw new Error('invalid_image_type');
	if (buffer.length > AVATAR_MAX_BYTES) throw new Error('avatar_too_large');

	ensureDir();
	deleteAvatarFiles(userId);

	const filePath = path.join(AVATAR_DIR, `${userId}.${ext}`);
	fs.writeFileSync(filePath, buffer);
	logger.info('[avatar] saved', { userId, bytes: buffer.length, ext });
	return avatarApiPath(userId);
}

export function deleteAvatarFiles(userId: string): void {
	ensureDir();
	for (const ext of ALLOWED_MIME.values()) {
		const filePath = path.join(AVATAR_DIR, `${userId}.${ext}`);
		if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
	}
}

/** Prioriza archivo subido; si no, URL externa guardada en MongoDB. */
export function resolveAvatarUrl(userId: string, storedUrl?: string): string | undefined {
	if (hasUploadedAvatar(userId)) return avatarApiPath(userId);
	if (storedUrl?.startsWith('http://') || storedUrl?.startsWith('https://')) return storedUrl;
	return undefined;
}
