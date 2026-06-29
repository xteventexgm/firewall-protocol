/**
 * Cliente S3-compatible para avatares (Cloudflare R2, MinIO local, AWS S3).
 * Activo cuando `AVATAR_STORAGE` es `r2`, `s3` o `minio`.
 */
import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadBucketCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import {
	AVATAR_STORAGE,
	AVATAR_STORAGE_LABEL,
	S3_ACCESS_KEY,
	S3_BUCKET,
	S3_ENDPOINT,
	S3_REGION,
	S3_SECRET_KEY,
} from '../config/env';
import { logger } from '../utils/logger';

let client: S3Client | null = null;
let bucketReady = false;
let lastError: string | null = null;

export function isObjectStorageEnabled(): boolean {
	return AVATAR_STORAGE === 's3';
}

export function getObjectStorageProvider(): string {
	return AVATAR_STORAGE_LABEL;
}

export function isObjectStorageConnected(): boolean {
	return bucketReady && client !== null;
}

export function getObjectStorageLastError(): string | null {
	return lastError;
}

export function getS3Client(): S3Client {
	if (!isObjectStorageEnabled()) {
		throw new Error('Object storage no está habilitado (AVATAR_STORAGE≠r2|s3|minio)');
	}
	if (!client) {
		client = new S3Client({
			region: S3_REGION,
			endpoint: S3_ENDPOINT,
			forcePathStyle: true,
			credentials: {
				accessKeyId: S3_ACCESS_KEY,
				secretAccessKey: S3_SECRET_KEY,
			},
		});
	}
	return client;
}

function isNotFoundError(err: unknown): boolean {
	if (!err || typeof err !== 'object') return false;
	const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
	return e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404;
}

export async function ensureObjectStorageBucket(): Promise<void> {
	if (!isObjectStorageEnabled()) return;

	if (!S3_ENDPOINT) {
		throw new Error('S3_ENDPOINT (o R2_ENDPOINT) es obligatorio con AVATAR_STORAGE=r2|s3|minio');
	}
	if (!S3_ACCESS_KEY || !S3_SECRET_KEY) {
		throw new Error(
			'S3_ACCESS_KEY y S3_SECRET_KEY son obligatorios (en R2: API token con permisos de lectura/escritura)',
		);
	}

	try {
		await getS3Client().send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
		bucketReady = true;
		lastError = null;
		logger.info('[object-storage] ready', {
			provider: AVATAR_STORAGE_LABEL,
			endpoint: S3_ENDPOINT,
			bucket: S3_BUCKET,
			region: S3_REGION,
		});
	} catch (err: unknown) {
		bucketReady = false;
		lastError = err instanceof Error ? err.message : String(err);
		throw new Error(
			`No se pudo acceder al bucket ${AVATAR_STORAGE_LABEL.toUpperCase()} (${S3_BUCKET}).\n` +
				`Endpoint: ${S3_ENDPOINT}\n` +
				`Detalle: ${lastError}\n` +
				`Crea el bucket en Cloudflare R2 o usa AVATAR_STORAGE=disk.`,
		);
	}
}

export async function objectStorageExists(key: string): Promise<boolean> {
	try {
		await getS3Client().send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
		return true;
	} catch (err: unknown) {
		if (isNotFoundError(err)) return false;
		throw err;
	}
}

export async function getObjectStorageStream(key: string): Promise<Readable> {
	const response = await getS3Client().send(
		new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
	);
	if (!response.Body) {
		throw new Error(`Objeto vacío: ${key}`);
	}
	return response.Body as Readable;
}

export async function putObjectStorage(
	key: string,
	buffer: Buffer,
	contentType: string,
): Promise<void> {
	await getS3Client().send(
		new PutObjectCommand({
			Bucket: S3_BUCKET,
			Key: key,
			Body: buffer,
			ContentType: contentType,
		}),
	);
}

export async function deleteObjectStorage(key: string): Promise<void> {
	try {
		await getS3Client().send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
	} catch (err: unknown) {
		if (isNotFoundError(err)) return;
		throw err;
	}
}
