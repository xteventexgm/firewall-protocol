import { Socket, Namespace } from 'socket.io';
import RoomManager from '../game/RoomManager';

export default function registerGameHandlers(socket: Socket, ns: Namespace) {
  socket.on('playerAction', (roomId: string, action: any) => {
    try {
      const room = RoomManager.getRoom(roomId);
      if (!room) { socket.emit('error', 'room not found'); return; }
      const ok = room.submitAction(action);
      if (ok) socket.emit('actionAccepted', action.id);
      else socket.emit('error', 'action rejected');
    } catch (err: any) {
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('startGame', (roomId: string) => {
    try {
      const room = RoomManager.getRoom(roomId);
      if (!room) { socket.emit('error', 'room not found'); return; }
      room.startGame();
    } catch (err: any) {
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('advancePhase', async (roomId: string) => {
    try {
      const room = RoomManager.getRoom(roomId);
      if (!room) { socket.emit('error', 'room not found'); return; }
      await room.advancePhase();
    } catch (err: any) {
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('submitVote', (roomId: string, vote: any) => {
    try {
      const room = RoomManager.getRoom(roomId);
      if (!room) { socket.emit('error', 'room not found'); return; }
      const { voter, target } = vote;
      const ok = room.submitVote(voter, target ?? null);
      if (!ok) socket.emit('error', 'vote rejected');
    } catch (err: any) {
      socket.emit('error', err.message || String(err));
    }
  });
}
