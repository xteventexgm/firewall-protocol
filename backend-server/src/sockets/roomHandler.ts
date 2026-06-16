import { Socket, Namespace } from 'socket.io';
import RoomManager from '../game/RoomManager';
import { Player } from '../models/PlayerProfile';

export default function registerRoomHandlers(socket: Socket, ns: Namespace) {
  socket.on('joinRoom', (roomId: string, playerId: string, name?: string) => {
    try {
      let room = RoomManager.getRoom(roomId);
      if (!room) room = RoomManager.createRoom(roomId, { autoAdvance: false });
      const p = new Player(playerId, name || `Player-${playerId}`, socket.id);
      room.addPlayer(p);
      socket.join(roomId);
      // emit the (possibly restored) room state to the joining socket/room
      ns.to(roomId).emit('roomState', roomId, room.state.toPlain ? room.state.toPlain() : room.state);
    } catch (err: any) {
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('leaveRoom', (roomId: string, playerId: string) => {
    try {
      const room = RoomManager.getRoom(roomId);
      if (!room) { socket.emit('error', 'room not found'); return; }
      room.removePlayer(playerId);
      socket.leave(roomId);
      ns.to(roomId).emit('roomState', roomId, room.state);
      if (room.state.players.length === 0) RoomManager.deleteRoom(roomId);
    } catch (err: any) {
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('createRoom', (roomId: string) => {
    try {
      RoomManager.createRoom(roomId);
      ns.emit('roomCreated', roomId);
    } catch (err: any) {
      socket.emit('error', err.message || String(err));
    }
  });
}
