/**
 * Punto de entrada HTTP del servicio de identidad.
 */
import app from './app';
import { PORT, assertRequiredRuntimeEnv } from './config/env';
import { connectMongo, isMongoEnabled } from './services/mongoConnection';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  try {
    assertRequiredRuntimeEnv();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n[identity] Configuración incompleta:\n${msg}\n`);
    process.exit(1);
  }

  if (isMongoEnabled()) {
    try {
      await connectMongo();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n[identity] No se pudo conectar a MongoDB:\n${msg}\n`);
      process.exit(1);
    }
  } else {
    console.warn('[identity] MONGO_URI no configurado — auth deshabilitado hasta configurar MongoDB.');
  }

  app.listen(PORT, () => {
    logger.info(`Identity service listening on port ${PORT}`, {
      mongodb: isMongoEnabled() ? 'enabled' : 'disabled',
    });
  });
}

void bootstrap().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[identity] Error fatal: ${msg}`);
  process.exit(1);
});
