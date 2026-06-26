/**
 * Helpers de logging estructurado para eventos socket y salas.
 * Prefijos consistentes: `[mobile /game]`, `[dashboard]`, `[room]`.
 */
import { logger } from './logger';

type ClientTag = 'dashboard' | 'mobile' | 'socket';

/** Registra evento de cliente móvil o dashboard con socketId y detalle opcional. */
export function logClient(tag: ClientTag, event: string, socketId: string, detail?: Record<string, unknown>) {
  const prefix = tag === 'mobile' ? '[mobile /game]' : tag === 'dashboard' ? '[dashboard]' : '[socket]';
  if (detail && Object.keys(detail).length > 0) {
    logger.info(prefix, event, `socket=${socketId}`, detail);
  } else {
    logger.info(prefix, event, `socket=${socketId}`);
  }
}

/** Registra acciones del ciclo de vida de una sala (crear, restaurar, bridge, borrar). */
export function logRoom(action: string, roomId: string, detail?: Record<string, unknown>) {
  if (detail) {
    logger.info('[room]', action, `roomId=${roomId}`, detail);
  } else {
    logger.info('[room]', action, `roomId=${roomId}`);
  }
}
