import * as http from 'http';
import { Server as IOServer, Namespace } from 'socket.io';
import RoomManager from '../game/RoomManager';
import registerRoomHandlers from './roomHandler';
import registerGameHandlers from './gameHandler';
import registerDashboardHandlers from './dashboardHandler';
import { broadcastRoomState } from './roomBridge';

export function initSockets(server: http.Server) {
  const io = new IOServer(server, { cors: { origin: '*' } });
  const gameNs: Namespace = io.of('/game');
  const dashboardNs: Namespace = io.of('/dashboard');

  gameNs.on('connection', (socket) => {
    registerRoomHandlers(socket, gameNs, dashboardNs);
    registerGameHandlers(socket, gameNs);

    socket.on('disconnect', () => {
      const found = RoomManager.findPlayerBySocketId(socket.id);
      if (found) {
        found.room.markPlayerDisconnected(socket.id);
        broadcastRoomState(gameNs, found.room);
      }
    });
  });

  dashboardNs.on('connection', (socket) => {
    registerDashboardHandlers(socket, dashboardNs, gameNs);
  });

  return io;
}

export default initSockets;
