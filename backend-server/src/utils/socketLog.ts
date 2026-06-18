import { logger } from './logger';

type ClientTag = 'dashboard' | 'mobile' | 'socket';

export function logClient(tag: ClientTag, event: string, socketId: string, detail?: Record<string, unknown>) {
  const prefix = tag === 'mobile' ? '[mobile /game]' : tag === 'dashboard' ? '[dashboard]' : '[socket]';
  if (detail && Object.keys(detail).length > 0) {
    logger.info(prefix, event, `socket=${socketId}`, detail);
  } else {
    logger.info(prefix, event, `socket=${socketId}`);
  }
}

export function logRoom(action: string, roomId: string, detail?: Record<string, unknown>) {
  if (detail) {
    logger.info('[room]', action, `roomId=${roomId}`, detail);
  } else {
    logger.info('[room]', action, `roomId=${roomId}`);
  }
}
