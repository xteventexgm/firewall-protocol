/**
 * Cliente MinIO para almacenamiento de avatares (S3-compatible).
 * Activo cuando `AVATAR_STORAGE=minio` en `.env`.
 */
import { Client } from 'minio';
import {
	AVATAR_STORAGE,
	MINIO_ACCESS_KEY,
	MINIO_BUCKET,
	MINIO_ENDPOINT,
	MINIO_PORT,
	MINIO_SECRET_KEY,
	MINIO_USE_SSL,
} from '../config/env';
import { logger } from '../utils/logger';

let client: Client | null = null;
let bucketReady = false;
let lastError: string | null = null;

export function isMinioAvatarStorage(): boolean {
	return AVATAR_STORAGE === 'minio';
}

export function isMinioConnected(): boolean {
	return bucketReady && client !== null;
}

export function getMinioLastError(): string | null {
	return lastError;
}

export function getMinioClient(): Client {
	if (!isMinioAvatarStorage()) {
		throw new Error('MinIO no está habilitado (AVATAR_STORAGE≠minio)');
	}
	if (!client) {
		client = new Client({
			endPoint: MINIO_ENDPOINT,
			port: MINIO_PORT,
			useSSL: MINIO_USE_SSL,
			accessKey: MINIO_ACCESS_KEY,
			secretKey: MINIO_SECRET_KEY,
		});
	}
	return client;
}

export async function ensureMinioBucket(): Promise<void> {
	if (!isMinioAvatarStorage()) return;

	if (!MINIO_ACCESS_KEY || !MINIO_SECRET_KEY) {
		throw new Error('MINIO_ACCESS_KEY y MINIO_SECRET_KEY son obligatorios con AVATAR_STORAGE=minio');
	}

	try {
		const minio = getMinioClient();
		const exists = await minio.bucketExists(MINIO_BUCKET);
		if (!exists) {
			await minio.makeBucket(MINIO_BUCKET, 'us-east-1');
			logger.info('[minio] bucket created', { bucket: MINIO_BUCKET });
		}
		bucketReady = true;
		lastError = null;
		logger.info('[minio] ready', {
			endpoint: MINIO_ENDPOINT,
			port: MINIO_PORT,
			bucket: MINIO_BUCKET,
			ssl: MINIO_USE_SSL,
		});
	} catch (err: unknown) {
		bucketReady = false;
		lastError = err instanceof Error ? err.message : String(err);
		throw new Error(
			`No se pudo conectar a MinIO (bucket: ${MINIO_BUCKET}).\n` +
				`Endpoint: ${MINIO_ENDPOINT}:${MINIO_PORT}\n` +
				`Detalle: ${lastError}\n` +
				`Inicia MinIO (docker compose up minio) o usa AVATAR_STORAGE=disk`,
		);
	}
}
