import { Socket, Namespace } from 'socket.io';
import RoomManager, { RoomClosedError } from '../game/RoomManager';
import Room, { RoomJoinDeniedError } from '../game/Room';
import { Player } from '../models/PlayerProfile';
import { MAX_PLAYERS } from '../utils/constants';
import { logClient } from '../utils/socketLog';
import { logger } from '../utils/logger';

export default function registerRoomHandlers(socket: Socket, gameNs: Namespace, dashboardNs: Namespace) {
  logClient('mobile', 'connected', socket.id);

  socket.on('joinRoom', (roomId: string, playerId: string, name?: string) => {
    try {
      const code = roomId.trim().toUpperCase();
      logClient('mobile', 'joinRoom', socket.id, { roomId: code, playerId, name });

      let room;
      try {
        room = RoomManager.getOrRestoreRoom(code, gameNs, dashboardNs);
      } catch (err) {
        if (err instanceof RoomClosedError) {
          logger.warn('[mobile] joinRoom — sala terminada', { roomId: code, playerId });
          socket.emit('error', err.message);
          return;
        }
        throw err;
      }

      if (!room) {
        logger.warn('[mobile] joinRoom — sala no existe', { roomId: code, playerId });
        socket.emit('error', 'Room not found. Ask the host for a valid room code.');
        return;
      }

      if (!room.state.getPlayer(playerId) && room.state.players.length >= MAX_PLAYERS) {
        logger.warn('[mobile] joinRoom — sala llena', { roomId: code, playerId });
        socket.emit('error', `Room is full (max ${MAX_PLAYERS} players)`);
        return;
      }

      const existing = room.state.getPlayer(playerId);
      if (existing) {
        const previousSocketId = existing.socketId;
        room.reconnectPlayer(playerId, socket.id, name);
        if (previousSocketId && previousSocketId !== socket.id) {
          gameNs.sockets.get(previousSocketId)?.disconnect(true);
        }
        logClient('mobile', 'joinRoom reconnect', socket.id, { roomId: code, playerId });
      } else {
        const p = new Player(playerId, name || `Player-${playerId}`, socket.id);
        try {
          room.addPlayer(p);
        } catch (err) {
          if (err instanceof RoomJoinDeniedError) {
            logger.warn('[mobile] joinRoom — partida en curso', { roomId: code, playerId, phase: room.state.phase });
            socket.emit('error', err.message);
            return;
          }
          throw err;
        }
        logClient('mobile', 'joinRoom new player', socket.id, {
          roomId: code,
          playerId,
          totalPlayers: room.state.players.length,
        });
      }

      socket.join(code);
      logClient('mobile', 'joinRoom OK', socket.id, {
        roomId: code,
        phase: room.state.phase,
        players: room.state.players.length,
      });
    } catch (err: any) {
      logger.error('[mobile] joinRoom FAIL', err.message || err);
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('leaveRoom', (roomId: string, playerId: string) => {
    try {
      const code = roomId.trim().toUpperCase();
      logClient('mobile', 'leaveRoom', socket.id, { roomId: code, playerId });
      const room = RoomManager.getRoom(code);
      if (!room) { socket.emit('error', 'room not found'); return; }
      room.removePlayer(playerId);
      socket.leave(code);
      if (room.state.players.length === 0) RoomManager.deleteRoom(code);
      logClient('mobile', 'leaveRoom OK', socket.id, { roomId: code, playerId });
    } catch (err: any) {
      logger.error('[mobile] leaveRoom FAIL', err.message || err);
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('createRoom', () => {
    logger.warn('[mobile] createRoom rechazado — solo el dashboard puede crear salas');
    socket.emit('error', 'Only the dashboard can create rooms');
  });

  socket.on('disconnect', (reason) => {
    logClient('mobile', 'disconnected', socket.id, { reason });
  });
}
