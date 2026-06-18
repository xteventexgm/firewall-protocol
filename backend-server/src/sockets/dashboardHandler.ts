import { Socket, Namespace } from 'socket.io';
import RoomManager, { RoomClosedError } from '../game/RoomManager';
import { logClient } from '../utils/socketLog';
import { logger } from '../utils/logger';

export default function registerDashboardHandlers(socket: Socket, dashboardNs: Namespace, gameNs: Namespace) {
  logClient('dashboard', 'connected', socket.id);

  socket.on('joinDashboard', (roomId: string) => {
    try {
      const code = roomId.trim().toUpperCase();
      logClient('dashboard', 'joinDashboard', socket.id, { roomId: code });

      let room;
      try {
        room = RoomManager.getOrRestoreRoom(code, gameNs, dashboardNs);
      } catch (err) {
        if (err instanceof RoomClosedError) {
          socket.emit('error', err.message);
          return;
        }
        throw err;
      }

      if (!room) {
        socket.emit('error', 'Room not found. Create a lobby first.');
        return;
      }

      socket.join(code);
      socket.emit('publicState', room.state.toPublicState());
      socket.emit('phaseChanged', code, room.state.phase);
      logClient('dashboard', 'joinDashboard OK', socket.id, {
        roomId: code,
        phase: room.state.phase,
        players: room.state.players.length,
      });
    } catch (err: any) {
      logger.error('[dashboard] joinDashboard FAIL', err.message || err);
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('leaveDashboard', (roomId: string) => {
    logClient('dashboard', 'leaveDashboard', socket.id, { roomId });
    socket.leave(roomId);
  });

  socket.on('createRoom', (roomId: string, maxPlayers: number) => {
    try {
      const code = roomId.trim().toUpperCase();
      logClient('dashboard', 'createRoom', socket.id, { roomId: code, maxPlayers });
      const room = RoomManager.createRoom(code, { maxPlayers }, gameNs, dashboardNs);
      dashboardNs.emit('roomCreated', { roomId: code, maxPlayers: room.state.maxPlayers });
      logClient('dashboard', 'createRoom OK', socket.id, {
        roomId: code,
        maxPlayers: room.state.maxPlayers,
      });
    } catch (err: any) {
      logger.warn('[dashboard] createRoom FAIL', { roomId, error: err.message || String(err) });
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('startGame', (roomId: string) => {
    try {
      logClient('dashboard', 'startGame', socket.id, { roomId });
      const room = RoomManager.getRoom(roomId);
      if (!room) {
        logger.warn('[dashboard] startGame — sala no encontrada', { roomId });
        socket.emit('error', 'room not found');
        return;
      }
      room.startGame();
      logClient('dashboard', 'startGame OK', socket.id, {
        roomId,
        phase: room.state.phase,
        players: room.state.players.length,
      });
    } catch (err: any) {
      logger.error('[dashboard] startGame FAIL', err.message || err);
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('advancePhase', (roomId: string) => {
    try {
      const room = RoomManager.getRoom(roomId);
      const from = room?.state.phase;
      logClient('dashboard', 'advancePhase', socket.id, { roomId, from });
      if (!room) {
        socket.emit('error', 'room not found');
        return;
      }
      void room.advancePhase().then((next) => {
        logClient('dashboard', 'advancePhase OK', socket.id, { roomId, from, to: next });
      });
    } catch (err: any) {
      logger.error('[dashboard] advancePhase FAIL', err.message || err);
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('disconnect', (reason) => {
    logClient('dashboard', 'disconnected', socket.id, { reason });
  });
}
