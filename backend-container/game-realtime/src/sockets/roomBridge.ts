/**
 * Puente eventos internos `Room` → emisiones Socket.IO.
 */
import { Namespace, Socket } from 'socket.io';
import Room from '../game/Room';
import { toPublicNightResolution } from '../types/events.types';
import { attachBotController } from '../game/BotController';
import { buildBotQaLog } from '../game/PublicLogService';

export function broadcastRoomState(gameNs: Namespace, room: Room) {
  for (const p of room.state.players) {
    if (p.socketId && p.isConnected) {
      gameNs.to(p.socketId).emit('roomState', room.id, room.state.toPlainForPlayer(p.id));
    }
  }
}

function broadcastPublicState(dashboardNs: Namespace | undefined, room: Room) {
  if (!dashboardNs) return;
  dashboardNs.to(room.id).emit('publicState', room.state.toPublicState());
}

export function attachRoomBridge(room: Room, gameNs: Namespace, dashboardNs?: Namespace) {
  if ((room as any)._bridged) return;
  (room as any)._bridged = true;
  attachBotController(room);

  const refresh = () => {
    broadcastRoomState(gameNs, room);
    broadcastPublicState(dashboardNs, room);
  };

  room.on('actionAccepted', refresh);

  room.on('phaseChanged', ({ roomId, to }) => {
    gameNs.to(roomId).emit('phaseChanged', roomId, to);
    dashboardNs?.to(room.id).emit('phaseChanged', roomId, to);
    refresh();
  });

  room.on('phaseTransition', (payload) => {
    gameNs.to(room.id).emit('phaseTransition', payload);
    dashboardNs?.to(room.id).emit('phaseTransition', payload);
  });

  room.on('phaseConfigChanged', ({ roomId, config }) => {
    dashboardNs?.to(roomId).emit('phaseConfigChanged', roomId, config);
    gameNs.to(roomId).emit('phaseConfigChanged', roomId, config);
    refresh();
  });

  room.on('incidentReport', (report) => {
    gameNs.to(room.id).emit('incidentReport', report);
    dashboardNs?.to(room.id).emit('incidentReport', report);
    refresh();
  });

  room.on('nightResolved', ({ roomId, resolution }) => {
    const publicResolution = toPublicNightResolution(resolution);
    gameNs.to(roomId).emit('nightResolved', roomId, publicResolution);
    dashboardNs?.to(roomId).emit('nightResolved', roomId, publicResolution);
    refresh();
  });

  room.on('privateResult', ({ roomId, playerId, payload }) => {
    const player = room.state.getPlayer(playerId);
    if (player?.socketId) {
      gameNs.to(player.socketId).emit('privateResult', roomId, payload);
    }
  });

  room.on('minigameChallenge', ({ roomId, playerId, challenge }) => {
    const player = room.state.getPlayer(playerId);
    if (player?.socketId) {
      gameNs.to(player.socketId).emit('minigameChallenge', roomId, challenge);
    }
  });

  room.on('minigameAnswerResult', ({ roomId, playerId, result, successHint, failHint }) => {
    const player = room.state.getPlayer(playerId);
    if (player?.socketId) {
      gameNs.to(player.socketId).emit('minigameAnswerResult', roomId, { result, successHint, failHint });
    }
  });

  room.on('chatMessage', ({ roomId, message }) => {
    gameNs.to(roomId).emit('chatMessage', roomId, message);
    if (message.channel === 'public') {
      dashboardNs?.to(roomId).emit('chatMessage', roomId, message);
    }
    refresh();
  });

  room.on('publicLog', ({ roomId, entry }) => {
    dashboardNs?.to(roomId).emit('publicLog', roomId, entry);
    gameNs.to(roomId).emit('publicLog', roomId, entry);
  });

  room.on('publicLogsBatch', ({ roomId, entries }) => {
    dashboardNs?.to(roomId).emit('publicLogsBatch', roomId, entries);
  });

  room.on('nightProgress', ({ roomId, progress }) => {
    gameNs.to(roomId).emit('nightProgress', roomId, progress);
    dashboardNs?.to(roomId).emit('nightProgress', roomId, progress);
  });

  room.on('gameStats', ({ roomId, stats }) => {
    gameNs.to(roomId).emit('gameStats', roomId, stats);
    dashboardNs?.to(roomId).emit('gameStats', roomId, stats);
  });

  room.on('rolesAssigned', refresh);
  room.on('playerJoined', ({ roomId, player }) => {
    dashboardNs?.to(roomId).emit('playerConnected', roomId, player.id, player.name);
    refresh();
  });
  room.on('playerConnected', ({ roomId, playerId, playerName }) => {
    dashboardNs?.to(roomId).emit('playerConnected', roomId, playerId, playerName);
    refresh();
  });
  room.on('playerLeft', refresh);
  room.on('playerKicked', ({ roomId, playerName, isBot }) => {
    const entry = buildBotQaLog(
      `${playerName} expulsado de la sala (${isBot ? 'bot' : 'jugador'})`,
      'warn',
    );
    room.state.publicLogs.push(entry);
    dashboardNs?.to(roomId).emit('publicLog', roomId, entry);
    gameNs.to(roomId).emit('publicLog', roomId, entry);
    refresh();
  });
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

  room.on('playerReconnected', ({ roomId, playerId, playerName }) => {
    gameNs.to(roomId).emit('playerReconnected', roomId, playerId, playerName);
    dashboardNs?.to(roomId).emit('playerReconnected', roomId, playerId, playerName);
    refresh();
  });

  room.on('playerDisconnected', ({ roomId, playerId, playerName }) => {
    gameNs.to(roomId).emit('playerDisconnected', roomId, playerId, playerName);
    dashboardNs?.to(roomId).emit('playerDisconnected', roomId, playerId, playerName);
    refresh();
  });

  room.on('playerEliminated', ({ roomId, playerId, reason, role }) => {
    gameNs.to(roomId).emit('playerEliminated', roomId, playerId, reason, role);
    dashboardNs?.to(roomId).emit('playerEliminated', roomId, playerId, reason, role);
    refresh();
  });

  room.on('gameOver', ({ roomId, winner, soloWinner }) => {
    gameNs.to(roomId).emit('gameOver', roomId, winner, soloWinner);
    dashboardNs?.to(roomId).emit('gameOver', roomId, winner, soloWinner);
    refresh();
  });
}
