import * as http from 'http';
import { Server as IOServer, Namespace } from 'socket.io';
import RoomManager from '../game/RoomManager';
import registerRoomHandlers from './roomHandler';
import registerGameHandlers from './gameHandler';

export function initSockets(server: http.Server) {
  const io = new IOServer(server, { cors: { origin: '*' } });
  const ns: Namespace = io.of('/game');

  ns.on('connection', (socket) => {
    ns.emit('debug', `socket connected ${socket.id}`);
    registerRoomHandlers(socket, ns);
    registerGameHandlers(socket, ns);

    socket.on('disconnect', () => {
      ns.emit('debug', `socket disconnected ${socket.id}`);
      const found = RoomManager.findPlayerBySocketId(socket.id);
      if (found) {
        found.room.markPlayerDisconnected(socket.id);
        ns.to(found.room.id).emit('roomState', found.room.id, found.room.state.toPlain());
      }
    });
  });

  return io;
}

export default initSockets;