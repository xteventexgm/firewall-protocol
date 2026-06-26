/**
 * Migra avatares de `data/avatars/` al bucket R2/S3 configurado.
 *
 * Uso: AVATAR_STORAGE=r2 npm run avatars:migrate-to-s3
 */
import 'dotenv/config';
import { connectMongo, isMongoEnabled } from '../src/services/mongoConnection';
import {
	ensureObjectStorageBucket,
	getObjectStorageProvider,
	isObjectStorageEnabled,
} from '../src/services/objectStorageClient';
import {
	listDiskAvatarUserIds,
	migrateDiskAvatarToObjectStorage,
} from '../src/services/AvatarService';
import { logger } from '../src/utils/logger';

async function main(): Promise<void> {
	if (!isObjectStorageEnabled()) {
		console.error('Define AVATAR_STORAGE=r2 (o s3|minio) en .env antes de migrar.');
		process.exit(1);
	}

	if (isMongoEnabled()) {
		await connectMongo();
	}

	await ensureObjectStorageBucket();

	const userIds = await listDiskAvatarUserIds();
	if (userIds.length === 0) {
		console.log('No hay avatares en disco para migrar.');
		return;
	}

	let migrated = 0;
	for (const userId of userIds) {
		const ok = await migrateDiskAvatarToObjectStorage(userId);
		if (ok) migrated += 1;
	}

	const provider = getObjectStorageProvider();
	logger.info('[avatar] migration complete', { total: userIds.length, migrated, provider });
	console.log(`Migrados ${migrated}/${userIds.length} avatares a ${provider}.`);
}

void main().catch((err: unknown) => {
	console.error(err);
	process.exit(1);
});
