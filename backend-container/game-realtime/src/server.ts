/**
 * Punto de entrada HTTP + Socket.IO del servicio game-realtime.
 */
import * as http from 'http';
import app from './app';
import initSockets from './sockets';
import { warmDatabaseCache } from './config/database';
import { MONGO_URI, PORT, assertRequiredRuntimeEnv } from './config/env';
import { connectMongo, isMongoEnabled } from './services/mongoConnection';
import { connectMongo as connectIdentityMongo, isMongoEnabled as isIdentityMongoEnabled } from '@firewall/identity-service';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  try {
    assertRequiredRuntimeEnv();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n[game-realtime] Configuración incompleta:\n${msg}\n`);
    process.exit(1);
  }

  if (isMongoEnabled()) {
    try {
      await connectMongo();
      // UserService / GameParticipationService del paquete identity usan su propio singleton.
      if (isIdentityMongoEnabled()) {
        await connectIdentityMongo();
      }
      await warmDatabaseCache();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n[game-realtime] No se pudo conectar a MongoDB:\n${msg}\n`);
      process.exit(1);
    }
  } else {
    console.warn('[game-realtime] MODO JSON LOCAL — MONGO_URI no configurado.');
  }

  const server = http.createServer(app);
  initSockets(server as http.Server);

  server.listen(PORT, "0.0.0.0", () => {
    logger.info(`Game-realtime listening on port ${PORT}`, {
      persistence: isMongoEnabled() ? 'mongodb' : 'json',
      mongoUri: isMongoEnabled() ? MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@') : undefined,
    });
  });
}

void bootstrap().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[game-realtime] Error fatal: ${msg}`);
  process.exit(1);
});
