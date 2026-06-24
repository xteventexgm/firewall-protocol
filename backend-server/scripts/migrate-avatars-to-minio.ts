/**
 * Migra avatares de `data/avatars/` al bucket MinIO configurado.
 *
 * Uso: AVATAR_STORAGE=minio npm run avatars:migrate-to-minio
 */
import 'dotenv/config';
import { connectMongo, isMongoEnabled } from '../src/services/mongoConnection';
import { ensureMinioBucket, isMinioAvatarStorage } from '../src/services/minioClient';
import { listDiskAvatarUserIds, migrateDiskAvatarToMinio } from '../src/services/AvatarService';
import { logger } from '../src/utils/logger';

async function main(): Promise<void> {
	if (!isMinioAvatarStorage()) {
		console.error('Define AVATAR_STORAGE=minio en .env antes de migrar.');
		process.exit(1);
	}

	if (isMongoEnabled()) {
		await connectMongo();
	}

	await ensureMinioBucket();

	const userIds = await listDiskAvatarUserIds();
	if (userIds.length === 0) {
		console.log('No hay avatares en disco para migrar.');
		return;
	}

	let migrated = 0;
	for (const userId of userIds) {
		const ok = await migrateDiskAvatarToMinio(userId);
		if (ok) migrated += 1;
	}

	logger.info('[avatar] migration complete', { total: userIds.length, migrated });
	console.log(`Migrados ${migrated}/${userIds.length} avatares a MinIO.`);
}

void main().catch((err: unknown) => {
	console.error(err);
	process.exit(1);
});
