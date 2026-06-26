/**
 * Avatares de perfil — disco (`data/avatars/`) o object storage S3 (`AVATAR_STORAGE=r2|s3`).
 * Solo pantalla de cuenta; no se muestra en partida.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { Response } from 'express';
import { DATA_DIRECTORY } from '../config/env';
import {
	deleteObjectStorage,
	getObjectStorageProvider,
	getObjectStorageStream,
	isObjectStorageEnabled,
	objectStorageExists,
	putObjectStorage,
} from './objectStorageClient';
import { S3_BUCKET } from '../config/env';
import { logger } from '../utils/logger';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED_MIME = new Map<string, string>([
	['image/jpeg', 'jpg'],
	['image/png', 'png'],
	['image/webp', 'webp'],
]);

const AVATAR_DIR = path.join(DATA_DIRECTORY, 'avatars');

export type AvatarFileDisk = { kind: 'disk'; filePath: string; mime: string };
export type AvatarFileS3 = { kind: 's3'; mime: string; stream: Readable };
export type AvatarFile = AvatarFileDisk | AvatarFileS3;

function ensureDir(): void {
	if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

function objectKey(userId: string, ext: string): string {
	return `${userId}.${ext}`;
}

export function avatarApiPath(userId: string): string {
	return `/api/auth/avatars/${userId}`;
}

export function getAvatarStorageMode(): string {
	return isObjectStorageEnabled() ? getObjectStorageProvider() : 'disk';
}

function hasUploadedAvatarDisk(userId: string): boolean {
	ensureDir();
	for (const ext of ALLOWED_MIME.values()) {
		if (fs.existsSync(path.join(AVATAR_DIR, `${userId}.${ext}`))) return true;
	}
	return false;
}

async function hasUploadedAvatarObjectStorage(userId: string): Promise<boolean> {
	for (const ext of ALLOWED_MIME.values()) {
		if (await objectStorageExists(objectKey(userId, ext))) return true;
	}
	return false;
}

export async function findAvatarFile(userId: string): Promise<AvatarFile | null> {
	if (isObjectStorageEnabled()) {
		for (const [mime, ext] of ALLOWED_MIME.entries()) {
			const key = objectKey(userId, ext);
			try {
				if (!(await objectStorageExists(key))) continue;
				const stream = await getObjectStorageStream(key);
				return { kind: 's3', mime, stream };
			} catch {
				// siguiente extensión
			}
		}
		return null;
	}

	ensureDir();
	for (const [mime, ext] of ALLOWED_MIME.entries()) {
		const filePath = path.join(AVATAR_DIR, `${userId}.${ext}`);
		if (fs.existsSync(filePath)) return { kind: 'disk', filePath, mime };
	}
	return null;
}

export async function saveAvatarFile(userId: string, buffer: Buffer, mimeType: string): Promise<string> {
	const ext = ALLOWED_MIME.get(mimeType);
	if (!ext) throw new Error('invalid_image_type');
	if (buffer.length > AVATAR_MAX_BYTES) throw new Error('avatar_too_large');

	await deleteAvatarFiles(userId);

	if (isObjectStorageEnabled()) {
		const key = objectKey(userId, ext);
		await putObjectStorage(key, buffer, mimeType);
		logger.info('[avatar] saved to object storage', {
			userId,
			bytes: buffer.length,
			ext,
			bucket: S3_BUCKET,
			provider: getObjectStorageProvider(),
		});
		return avatarApiPath(userId);
	}

	ensureDir();
	const filePath = path.join(AVATAR_DIR, `${userId}.${ext}`);
	fs.writeFileSync(filePath, buffer);
	logger.info('[avatar] saved to disk', { userId, bytes: buffer.length, ext });
	return avatarApiPath(userId);
}

export async function deleteAvatarFiles(userId: string): Promise<void> {
	if (isObjectStorageEnabled()) {
		for (const ext of ALLOWED_MIME.values()) {
			await deleteObjectStorage(objectKey(userId, ext));
		}
		return;
	}

	ensureDir();
	for (const ext of ALLOWED_MIME.values()) {
		const filePath = path.join(AVATAR_DIR, `${userId}.${ext}`);
		if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
	}
}

/** Prioriza ruta API en Mongo; fallback disco legacy sin campo en BD. */
export function resolveAvatarUrl(userId: string, storedUrl?: string): string | undefined {
	if (storedUrl?.startsWith('/api/auth/avatars/')) return storedUrl;
	if (storedUrl?.startsWith('http://') || storedUrl?.startsWith('https://')) return storedUrl;
	if (!isObjectStorageEnabled() && hasUploadedAvatarDisk(userId)) return avatarApiPath(userId);
	return undefined;
}

/** Sirve bytes al cliente (proxy API — el móvil no habla con R2 directamente). */
export async function serveAvatarFile(userId: string, res: Response): Promise<boolean> {
	const found = await findAvatarFile(userId);
	if (!found) return false;

	res.setHeader('Content-Type', found.mime);
	res.setHeader('Cache-Control', 'public, max-age=300');

	if (found.kind === 'disk') {
		res.sendFile(found.filePath);
		return true;
	}

	found.stream.pipe(res);
	return true;
}

/** Migración disco → R2/S3 (script `avatars:migrate-to-s3`). */
export async function migrateDiskAvatarToObjectStorage(userId: string): Promise<boolean> {
	if (!isObjectStorageEnabled()) return false;
	ensureDir();
	for (const [mime, ext] of ALLOWED_MIME.entries()) {
		const filePath = path.join(AVATAR_DIR, `${userId}.${ext}`);
		if (!fs.existsSync(filePath)) continue;
		const buffer = fs.readFileSync(filePath);
		await putObjectStorage(objectKey(userId, ext), buffer, mime);
		fs.unlinkSync(filePath);
		logger.info('[avatar] migrated disk→object storage', {
			userId,
			ext,
			provider: getObjectStorageProvider(),
		});
		return true;
	}
	return false;
}

export async function listDiskAvatarUserIds(): Promise<string[]> {
	ensureDir();
	const ids = new Set<string>();
	for (const name of fs.readdirSync(AVATAR_DIR)) {
		const match = /^(.+)\.(jpg|png|webp)$/i.exec(name);
		if (match) ids.add(match[1]);
	}
	return [...ids];
}

export { hasUploadedAvatarObjectStorage };
