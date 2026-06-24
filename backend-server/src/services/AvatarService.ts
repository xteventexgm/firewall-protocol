/**
 * Avatares de perfil — disco (`data/avatars/`) o MinIO (`AVATAR_STORAGE=minio`).
 * Solo pantalla de cuenta; no se muestra en partida.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { Response } from 'express';
import { DATA_DIRECTORY } from '../config/env';
import { isMinioAvatarStorage, getMinioClient } from './minioClient';
import { MINIO_BUCKET } from '../config/env';
import { logger } from '../utils/logger';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED_MIME = new Map<string, string>([
	['image/jpeg', 'jpg'],
	['image/png', 'png'],
	['image/webp', 'webp'],
]);

const AVATAR_DIR = path.join(DATA_DIRECTORY, 'avatars');

export type AvatarFileDisk = { kind: 'disk'; filePath: string; mime: string };
export type AvatarFileMinio = { kind: 'minio'; mime: string; stream: Readable };
export type AvatarFile = AvatarFileDisk | AvatarFileMinio;

function ensureDir(): void {
	if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

function objectKey(userId: string, ext: string): string {
	return `${userId}.${ext}`;
}

export function avatarApiPath(userId: string): string {
	return `/api/auth/avatars/${userId}`;
}

export function getAvatarStorageMode(): 'disk' | 'minio' {
	return isMinioAvatarStorage() ? 'minio' : 'disk';
}

function hasUploadedAvatarDisk(userId: string): boolean {
	ensureDir();
	for (const ext of ALLOWED_MIME.values()) {
		if (fs.existsSync(path.join(AVATAR_DIR, `${userId}.${ext}`))) return true;
	}
	return false;
}

async function hasUploadedAvatarMinio(userId: string): Promise<boolean> {
	const minio = getMinioClient();
	for (const ext of ALLOWED_MIME.values()) {
		try {
			await minio.statObject(MINIO_BUCKET, objectKey(userId, ext));
			return true;
		} catch {
			// objeto no existe
		}
	}
	return false;
}

export async function findAvatarFile(userId: string): Promise<AvatarFile | null> {
	if (isMinioAvatarStorage()) {
		const minio = getMinioClient();
		for (const [mime, ext] of ALLOWED_MIME.entries()) {
			const key = objectKey(userId, ext);
			try {
				await minio.statObject(MINIO_BUCKET, key);
				const stream = await minio.getObject(MINIO_BUCKET, key);
				return { kind: 'minio', mime, stream };
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

	if (isMinioAvatarStorage()) {
		const minio = getMinioClient();
		const key = objectKey(userId, ext);
		await minio.putObject(MINIO_BUCKET, key, buffer, buffer.length, {
			'Content-Type': mimeType,
		});
		logger.info('[avatar] saved to minio', { userId, bytes: buffer.length, ext, bucket: MINIO_BUCKET });
		return avatarApiPath(userId);
	}

	ensureDir();
	const filePath = path.join(AVATAR_DIR, `${userId}.${ext}`);
	fs.writeFileSync(filePath, buffer);
	logger.info('[avatar] saved to disk', { userId, bytes: buffer.length, ext });
	return avatarApiPath(userId);
}

export async function deleteAvatarFiles(userId: string): Promise<void> {
	if (isMinioAvatarStorage()) {
		const minio = getMinioClient();
		for (const ext of ALLOWED_MIME.values()) {
			const key = objectKey(userId, ext);
			try {
				await minio.removeObject(MINIO_BUCKET, key);
			} catch {
				// ignorar si no existe
			}
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
	if (!isMinioAvatarStorage() && hasUploadedAvatarDisk(userId)) return avatarApiPath(userId);
	return undefined;
}

/** Sirve bytes al cliente (proxy API — el móvil no habla con MinIO directamente). */
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

/** Migración disco → MinIO (script `avatars:migrate-to-minio`). */
export async function migrateDiskAvatarToMinio(userId: string): Promise<boolean> {
	if (!isMinioAvatarStorage()) return false;
	ensureDir();
	for (const [mime, ext] of ALLOWED_MIME.entries()) {
		const filePath = path.join(AVATAR_DIR, `${userId}.${ext}`);
		if (!fs.existsSync(filePath)) continue;
		const buffer = fs.readFileSync(filePath);
		const minio = getMinioClient();
		await minio.putObject(MINIO_BUCKET, objectKey(userId, ext), buffer, buffer.length, {
			'Content-Type': mime,
		});
		fs.unlinkSync(filePath);
		logger.info('[avatar] migrated disk→minio', { userId, ext });
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

export { hasUploadedAvatarMinio };
