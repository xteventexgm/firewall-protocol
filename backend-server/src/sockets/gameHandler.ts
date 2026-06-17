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
      ns.to(roomId).emit('phaseChanged', room.state.roomId, room.state.phase);
      ns.to(roomId).emit('roomState', roomId, room.state);
    } catch (err: any) {
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('advancePhase', async (roomId: string) => {
    try {
      const room = RoomManager.getRoom(roomId);
      if (!room) { socket.emit('error', 'room not found'); return; }
      const next = await room.advancePhase();
      ns.to(roomId).emit('phaseChanged', roomId, next);
      ns.to(roomId).emit('roomState', roomId, room.state);
    } catch (err: any) {
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('submitVote', (roomId: string, vote: any) => {
    try {
      const room = RoomManager.getRoom(roomId);
      if (!room) { socket.emit('error', 'room not found'); return; }
      const { voter, target } = vote;
      const key = target || 'null';
      room.state.votes[key] = room.state.votes[key] || [];
      room.state.votes[key].push(voter);
      ns.to(roomId).emit('roomState', roomId, room.state);
    } catch (err: any) {
      socket.emit('error', err.message || String(err));
    }
  });
}
