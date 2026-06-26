import 'dotenv/config';
import * as path from 'path';

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = Number(process.env.PORT || 3003);
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
export const DATA_DIRECTORY = process.env.DATA_DIRECTORY || path.join(process.cwd(), 'data');
export const GATEWAY_PUBLIC_URL = (process.env.GATEWAY_PUBLIC_URL || '').trim().replace(/\/$/, '');
export const IDENTITY_URL = (process.env.IDENTITY_URL || 'http://localhost:3002').replace(/\/$/, '');
export const INTERNAL_SERVICE_KEY = (process.env.INTERNAL_SERVICE_KEY || '').trim();

const avatarStorageRaw = (process.env.AVATAR_STORAGE || 'disk').trim().toLowerCase();
export const AVATAR_STORAGE: 'disk' | 's3' = ['s3', 'r2', 'minio'].includes(avatarStorageRaw) ? 's3' : 'disk';
export const AVATAR_STORAGE_LABEL = AVATAR_STORAGE === 'disk' ? 'disk' : avatarStorageRaw;

function envFirst(...keys: string[]): string {
  for (const key of keys) {
    const value = (process.env[key] || '').trim();
    if (value) return value;
  }
  return '';
}

function resolveS3Endpoint(): string {
  const explicit = envFirst('S3_ENDPOINT', 'R2_ENDPOINT');
  if (explicit) {
    return explicit.startsWith('http://') || explicit.startsWith('https://')
      ? explicit
      : `https://${explicit}`;
  }
  const minioHost = (process.env.MINIO_ENDPOINT || '').trim();
  if (minioHost) {
    const useSsl = process.env.MINIO_USE_SSL === 'true' || process.env.MINIO_USE_SSL === '1';
    const port = String(process.env.MINIO_PORT || (useSsl ? 443 : 9000));
    const proto = useSsl ? 'https' : 'http';
    if ((useSsl && port === '443') || (!useSsl && port === '80')) return `${proto}://${minioHost}`;
    return `${proto}://${minioHost}:${port}`;
  }
  if (avatarStorageRaw === 'r2') {
    return 'https://ffe5e4f2990d77373e5b02dd67b16749.r2.cloudflarestorage.com';
  }
  return '';
}

export const S3_ENDPOINT = resolveS3Endpoint();
export const S3_ACCESS_KEY = envFirst('S3_ACCESS_KEY', 'R2_ACCESS_KEY_ID', 'MINIO_ACCESS_KEY');
export const S3_SECRET_KEY = envFirst('S3_SECRET_KEY', 'R2_SECRET_ACCESS_KEY', 'MINIO_SECRET_KEY');
export const S3_BUCKET = envFirst('S3_BUCKET', 'R2_BUCKET', 'MINIO_BUCKET') || 'avatars';
export const S3_REGION = envFirst('S3_REGION', 'R2_REGION') || 'auto';

export function isDockerRuntime(): boolean {
  return process.env.DOCKER === '1' || process.env.DOCKER === 'true';
}

export function assertRequiredRuntimeEnv(): void {
  if (!isDockerRuntime()) return;
  const missing: string[] = [];
  if (AVATAR_STORAGE === 's3') {
    if (!S3_ENDPOINT) missing.push('S3_ENDPOINT');
    if (!S3_ACCESS_KEY) missing.push('S3_ACCESS_KEY');
    if (!S3_SECRET_KEY) missing.push('S3_SECRET_KEY');
    if (!S3_BUCKET) missing.push('S3_BUCKET');
  }
  if (missing.length) {
    throw new Error(`Variables obligatorias en Docker:\n${missing.map((n) => `  - ${n}`).join('\n')}`);
  }
}
