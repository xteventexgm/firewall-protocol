import { Namespace } from 'socket.io';
import Room from '../game/Room';

export function broadcastRoomState(gameNs: Namespace, room: Room) {
  for (const p of room.state.players) {
    if (p.socketId && p.isConnected) {
      gameNs.to(p.socketId).emit('roomState', room.id, room.state.toPlainForPlayer(p.id));
    }
  }
}

export function broadcastPublicState(dashboardNs: Namespace | undefined, room: Room) {
  if (!dashboardNs) return;
  dashboardNs.to(room.id).emit('publicState', room.state.toPublicState());
}

export function attachRoomBridge(room: Room, gameNs: Namespace, dashboardNs?: Namespace) {
  if ((room as any)._bridged) return;
  (room as any)._bridged = true;

  const refresh = () => {
    broadcastRoomState(gameNs, room);
    broadcastPublicState(dashboardNs, room);
  };

  room.on('phaseChanged', ({ roomId, to }) => {
    gameNs.to(roomId).emit('phaseChanged', roomId, to);
    refresh();
  });

  room.on('phaseTransition', (payload) => {
    gameNs.to(room.id).emit('phaseTransition', payload);
    dashboardNs?.to(room.id).emit('phaseTransition', payload);
  });

  room.on('incidentReport', (report) => {
    gameNs.to(room.id).emit('incidentReport', report);
    dashboardNs?.to(room.id).emit('incidentReport', report);
    refresh();
  });

  room.on('nightResolved', ({ roomId, resolution }) => {
    gameNs.to(roomId).emit('nightResolved', roomId, resolution);
    refresh();
  });

  room.on('privateResult', ({ roomId, playerId, payload }) => {
    const player = room.state.getPlayer(playerId);
    if (player?.socketId) {
      gameNs.to(player.socketId).emit('privateResult', roomId, payload);
    }
  });

  room.on('rolesAssigned', refresh);
  room.on('playerJoined', refresh);
  room.on('playerLeft', refresh);
  room.on('voteRecorded', ({ roomId, voter, target, timestamp }) => {
    const trace = { roomId, voter, target, timestamp };
    gameNs.to(roomId).emit('voteTrace', trace);
    dashboardNs?.to(roomId).emit('voteTrace', trace);
    refresh();
  });

  room.on('voteTied', (payload) => {
    gameNs.to(room.id).emit('voteTied', payload);
    dashboardNs?.to(room.id).emit('voteTied', payload);
    refresh();
  });

  room.on('playerReconnected', ({ roomId, playerId }) => {
    gameNs.to(roomId).emit('playerReconnected', roomId, playerId);
    refresh();
  });

  room.on('playerDisconnected', ({ roomId, playerId }) => {
    gameNs.to(roomId).emit('playerDisconnected', roomId, playerId);
    refresh();
  });

  room.on('playerEliminated', ({ roomId, playerId, reason }) => {
    gameNs.to(roomId).emit('playerEliminated', roomId, playerId, reason);
    refresh();
  });

  room.on('gameOver', ({ roomId, winner, soloWinner }) => {
    gameNs.to(roomId).emit('gameOver', roomId, winner, soloWinner);
    dashboardNs?.to(roomId).emit('gameOver', roomId, winner, soloWinner);
    refresh();
  });
}
