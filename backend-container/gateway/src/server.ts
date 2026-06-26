/**
 * Punto de entrada del gateway — HTTP + upgrade WebSocket.
 */
import http from 'http';
import type { Socket } from 'net';
import { app, gameRealtimeSocketProxy } from './app';
import { GAME_REALTIME_URL, IDENTITY_URL, PORT } from './config/env';
import { logger } from './utils/logger';

const server = http.createServer(app);

/**
 * WebSocket upgrade — obligatorio para Socket.IO (transport=websocket).
 * Sin este handler el cliente se queda en "conectando..." tras el polling inicial.
 */
server.on('upgrade', (req, socket, head) => {
  const path = req.url ?? '';
  const isSocket =
    path.startsWith('/socket.io') ||
    path.startsWith('/game') ||
    path.startsWith('/dashboard');

  if (!isSocket) {
    logger.warn('WebSocket upgrade rechazado (ruta no enrutada)', { path });
    socket.destroy();
    return;
  }

  logger.debug('WebSocket upgrade → game-realtime', { path });
  gameRealtimeSocketProxy.upgrade(req, socket as Socket, head);
});

server.listen(PORT, () => {
  logger.info(`Gateway listening on port ${PORT}`, {
    identity: IDENTITY_URL,
    gameRealtime: GAME_REALTIME_URL,
    socketIo: `${GAME_REALTIME_URL}/socket.io/`,
  });
});
