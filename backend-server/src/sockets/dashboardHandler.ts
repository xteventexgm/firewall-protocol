import { Socket, Namespace } from 'socket.io';
import RoomManager from '../game/RoomManager';

export default function registerDashboardHandlers(socket: Socket, dashboardNs: Namespace, gameNs: Namespace) {
  socket.on('joinDashboard', (roomId: string) => {
    try {
      let room = RoomManager.getRoom(roomId);
      if (!room) room = RoomManager.createRoom(roomId, { autoAdvance: false }, gameNs, dashboardNs);
      else RoomManager.ensureBridge(room, gameNs, dashboardNs);

      socket.join(roomId);
      socket.emit('publicState', room.state.toPublicState());
      socket.emit('phaseChanged', roomId, room.state.phase);
    } catch (err: any) {
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('leaveDashboard', (roomId: string) => {
    socket.leave(roomId);
  });
}
