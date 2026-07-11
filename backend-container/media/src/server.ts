import app from './app';
import { PORT, assertRequiredRuntimeEnv } from './config/env';
import { ensureObjectStorageBucket, isObjectStorageEnabled } from './services/objectStorageClient';
import { getAvatarStorageMode } from './services/AvatarService';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  try {
    assertRequiredRuntimeEnv();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n[media] Configuración incompleta:\n${msg}\n`);
    process.exit(1);
  }

  if (isObjectStorageEnabled()) {
    try {
      await ensureObjectStorageBucket();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n[media] Object storage no disponible:\n${msg}\n`);
      process.exit(1);
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Media service listening on port ${PORT}`, { avatarStorage: getAvatarStorageMode() });
  });
}

void bootstrap().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[media] Error fatal: ${msg}`);
  process.exit(1);
});
