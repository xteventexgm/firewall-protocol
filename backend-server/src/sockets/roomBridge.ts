import { Namespace } from 'socket.io';
import Room from '../game/Room';

export function broadcastRoomState(ns: Namespace, room: Room) {
  for (const p of room.state.players) {
    if (p.socketId && p.isConnected) {
      ns.to(p.socketId).emit('roomState', room.id, room.state.toPlainForPlayer(p.id));
    }
  }
}

export function attachRoomBridge(room: Room, ns: Namespace) {
  if ((room as any)._bridged) return;
  (room as any)._bridged = true;

  room.on('phaseChanged', ({ roomId, to }) => {
    ns.to(roomId).emit('phaseChanged', roomId, to);
    broadcastRoomState(ns, room);
  });

  room.on('nightResolved', ({ roomId, resolution }) => {
    ns.to(roomId).emit('nightResolved', roomId, resolution);
    broadcastRoomState(ns, room);
  });

  room.on('rolesAssigned', () => broadcastRoomState(ns, room));
  room.on('playerJoined', () => broadcastRoomState(ns, room));
  room.on('playerLeft', () => broadcastRoomState(ns, room));
  room.on('voteRecorded', () => broadcastRoomState(ns, room));

  room.on('playerReconnected', ({ roomId, playerId }) => {
    ns.to(roomId).emit('playerReconnected', roomId, playerId);
    broadcastRoomState(ns, room);
  });

  room.on('playerDisconnected', ({ roomId, playerId }) => {
    ns.to(roomId).emit('playerDisconnected', roomId, playerId);
    broadcastRoomState(ns, room);
  });

  room.on('playerEliminated', ({ roomId, playerId, reason }) => {
    ns.to(roomId).emit('playerEliminated', roomId, playerId, reason);
    broadcastRoomState(ns, room);
  });

  room.on('gameOver', ({ roomId, winner }) => {
    ns.to(roomId).emit('gameOver', roomId, winner);
    broadcastRoomState(ns, room);
  });
}
