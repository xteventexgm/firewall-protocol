import { Socket, Namespace } from 'socket.io';
import RoomManager from '../game/RoomManager';
import { Player } from '../models/PlayerProfile';
import { MAX_PLAYERS } from '../utils/constants';
import { logClient } from '../utils/socketLog';
import { logger } from '../utils/logger';

export default function registerRoomHandlers(socket: Socket, gameNs: Namespace, dashboardNs: Namespace) {
  logClient('mobile', 'connected', socket.id);

  socket.on('joinRoom', (roomId: string, playerId: string, name?: string) => {
    try {
      logClient('mobile', 'joinRoom', socket.id, { roomId, playerId, name });
      let room = RoomManager.getRoom(roomId);
      const roomCreated = !room;
      if (!room) {
        room = RoomManager.createRoom(roomId, { autoAdvance: false }, gameNs, dashboardNs);
      } else {
        RoomManager.ensureBridge(room, gameNs, dashboardNs);
      }

      if (!room.state.getPlayer(playerId) && room.state.players.length >= MAX_PLAYERS) {
        logger.warn('[mobile] joinRoom — sala llena', { roomId, playerId });
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
        logClient('mobile', 'joinRoom reconnect', socket.id, { roomId, playerId });
      } else {
        const p = new Player(playerId, name || `Player-${playerId}`, socket.id);
        room.addPlayer(p);
        logClient('mobile', 'joinRoom new player', socket.id, {
          roomId,
          playerId,
          totalPlayers: room.state.players.length,
        });
      }

      socket.join(roomId);
      logClient('mobile', 'joinRoom OK', socket.id, {
        roomId,
        roomCreated,
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
      logClient('mobile', 'leaveRoom', socket.id, { roomId, playerId });
      const room = RoomManager.getRoom(roomId);
      if (!room) { socket.emit('error', 'room not found'); return; }
      room.removePlayer(playerId);
      socket.leave(roomId);
      if (room.state.players.length === 0) RoomManager.deleteRoom(roomId);
      logClient('mobile', 'leaveRoom OK', socket.id, { roomId, playerId });
    } catch (err: any) {
      logger.error('[mobile] leaveRoom FAIL', err.message || err);
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('createRoom', (roomId: string) => {
    try {
      logClient('mobile', 'createRoom', socket.id, { roomId });
      RoomManager.createRoom(roomId, {}, gameNs, dashboardNs);
      gameNs.emit('roomCreated', roomId);
    } catch (err: any) {
      logger.error('[mobile] createRoom FAIL', err.message || err);
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('disconnect', (reason) => {
    logClient('mobile', 'disconnected', socket.id, { reason });
  });
}
