import * as http from 'http';
import { Server as IOServer, Namespace } from 'socket.io';
import RoomManager from '../game/RoomManager';
import registerRoomHandlers from './roomHandler';
import registerGameHandlers from './gameHandler';
import registerDashboardHandlers from './dashboardHandler';
import { broadcastRoomState } from './roomBridge';
import { logClient } from '../utils/socketLog';
import { logger } from '../utils/logger';

export function initSockets(server: http.Server) {
  const io = new IOServer(server, { cors: { origin: '*' } });
  const gameNs: Namespace = io.of('/game');
  const dashboardNs: Namespace = io.of('/dashboard');

  gameNs.on('connection', (socket) => {
    registerRoomHandlers(socket, gameNs, dashboardNs);
    registerGameHandlers(socket, gameNs);

    socket.on('disconnect', (reason) => {
      const found = RoomManager.findPlayerBySocketId(socket.id);
      if (found) {
        logClient('mobile', 'player disconnected from room', socket.id, {
          roomId: found.room.id,
          playerId: found.player.id,
          reason,
        });
        found.room.markPlayerDisconnected(socket.id);
        broadcastRoomState(gameNs, found.room);
      } else {
        logClient('mobile', 'disconnect (no room)', socket.id, { reason });
      }
    });
  });

  dashboardNs.on('connection', (socket) => {
    registerDashboardHandlers(socket, dashboardNs, gameNs);
  });

  logger.info('[socket] namespaces ready', { game: '/game', dashboard: '/dashboard' });

  return io;
}

export default initSockets;
