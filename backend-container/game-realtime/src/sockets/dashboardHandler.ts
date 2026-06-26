/**
 * Handlers socket dashboard (host / pantalla pública).
 *
 * Eventos: `joinDashboard`, `leaveDashboard`, `createRoom`, `advancePhase`,
 * `startGame`, `kickPlayer`. Emite `publicState` y `roomCreated` al crear lobby.
 */
import { Socket, Namespace } from 'socket.io';
import RoomManager, { RoomClosedError } from '../game/RoomManager';
import { logClient } from '../utils/socketLog';
import { logger } from '../utils/logger';
import { MIN_PLAYERS } from '../utils/constants';
import { devBotsEnabled } from '../config/env';
import {
  formatSocketError,
  isValidRoomCode,
  normalizeRoomCode,
} from '../utils/socketErrors';

/** Registra handlers de host en namespace `/dashboard`. */
export default function registerDashboardHandlers(socket: Socket, dashboardNs: Namespace, gameNs: Namespace) {
  logClient('dashboard', 'connected', socket.id);

  socket.on('joinDashboard', (roomId: string) => {
    try {
      const code = normalizeRoomCode(roomId);
      logClient('dashboard', 'joinDashboard', socket.id, { roomId: code });

      if (!isValidRoomCode(code)) {
        socket.emit(
          'error',
          formatSocketError('Código de sala inválido. Usa el formato FIRE-XXXX.', 'invalid_room_code'),
        );
        return;
      }

      let room;
      try {
        room = RoomManager.getOrRestoreRoom(code, gameNs, dashboardNs);
      } catch (err) {
        if (err instanceof RoomClosedError) {
          socket.emit(
            'error',
            formatSocketError(`La sala ${code} ya terminó la partida.`, 'game_ended'),
          );
          return;
        }
        throw err;
      }

      if (!room) {
        socket.emit(
          'error',
          formatSocketError('Sala no encontrada. Crea un lobby primero.', 'room_not_found'),
        );
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
    socket.leave(normalizeRoomCode(roomId));
  });

  socket.on('abandonLobby', (roomId: string) => {
    try {
      const code = normalizeRoomCode(roomId);
      logClient('dashboard', 'abandonLobby', socket.id, { roomId: code });
      const room = RoomManager.getRoom(code);
      const payload = { reason: 'host_abandoned' as const };

      gameNs.to(code).emit('lobbyClosed', code, payload);
      if (room) {
        for (const player of room.state.players) {
          if (player.socketId) {
            gameNs.to(player.socketId).emit('lobbyClosed', code, payload);
          }
        }
      }

      RoomManager.abandonLobby(code);
      socket.leave(code);
    } catch (err: any) {
      logger.error('[dashboard] abandonLobby FAIL', err.message || err);
      socket.emit('error', err.message || String(err));
    }
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
      const code = normalizeRoomCode(roomId);
      logClient('dashboard', 'startGame', socket.id, { roomId: code });
      const room = RoomManager.getRoom(code);
      if (!room) {
        logger.warn('[dashboard] startGame — sala no encontrada', { roomId: code });
        socket.emit('error', formatSocketError('Sala no encontrada.', 'room_not_found'));
        return;
      }
      room.startGame();
      logClient('dashboard', 'startGame OK', socket.id, {
        roomId: code,
        phase: room.state.phase,
        players: room.state.players.length,
      });
    } catch (err: any) {
      logger.error('[dashboard] startGame FAIL', err.message || err);
      const msg = err.message || String(err);
      if (msg.includes('LOBBY')) {
        socket.emit('error', formatSocketError('Solo puedes iniciar desde el lobby.', 'wrong_phase'));
        return;
      }
      if (msg.includes('at least')) {
        socket.emit('error', formatSocketError(msg, 'not_enough_players'));
        return;
      }
      socket.emit('error', msg);
    }
  });

  socket.on('advancePhase', (roomId: string) => {
    try {
      const code = normalizeRoomCode(roomId);
      const room = RoomManager.getRoom(code);
      const from = room?.state.phase;
      logClient('dashboard', 'advancePhase', socket.id, { roomId: code, from });
      if (!room) {
        socket.emit('error', formatSocketError('Sala no encontrada.', 'room_not_found'));
        return;
      }
      void room.advancePhase()
        .then((next) => {
          logClient('dashboard', 'advancePhase OK', socket.id, { roomId: code, from, to: next });
        })
        .catch((err: any) => {
          logger.error('[dashboard] advancePhase FAIL', err.message || err);
          socket.emit('error', err.message || String(err));
        });
    } catch (err: any) {
      logger.error('[dashboard] advancePhase FAIL', err.message || err);
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('setPhaseConfig', (roomId: string, config: Record<string, unknown>) => {
    try {
      const code = normalizeRoomCode(roomId);
      const room = RoomManager.getRoom(code);
      if (!room) {
        socket.emit('error', formatSocketError('Sala no encontrada.', 'room_not_found'));
        return;
      }
      room.setPhaseConfig(config as any);
      socket.emit('phaseConfigChanged', code, room.state.phaseConfig);
    } catch (err: any) {
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('fillBots', (roomId: string, count?: number) => {
    try {
      if (!devBotsEnabled()) {
        socket.emit('error', formatSocketError('Bots desactivados en servidor (DEV_BOTS=false).', 'bots_disabled'));
        return;
      }
      const code = normalizeRoomCode(roomId);
      const room = RoomManager.getRoom(code);
      if (!room) {
        socket.emit('error', formatSocketError('Sala no encontrada.', 'room_not_found'));
        return;
      }
      const added = room.addOneBotPlayer();
      socket.emit('publicState', room.state.toPublicState());
      logClient('dashboard', 'fillBots OK', socket.id, {
        roomId: code,
        added,
        total: room.state.players.length,
      });
    } catch (err: any) {
      logger.warn('[dashboard] fillBots FAIL', err.message || err);
      const msg = String(err.message || err);
      if (msg.includes('jugador real')) {
        socket.emit(
          'error',
          formatSocketError(
            'Entra al menos un jugador real desde el móvil antes de añadir bots.',
            'bots_need_humans',
          ),
        );
        return;
      }
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('clearBots', (roomId: string) => {
    try {
      if (!devBotsEnabled()) {
        socket.emit('error', formatSocketError('Bots desactivados.', 'bots_disabled'));
        return;
      }
      const code = normalizeRoomCode(roomId);
      const room = RoomManager.getRoom(code);
      if (!room) {
        socket.emit('error', formatSocketError('Sala no encontrada.', 'room_not_found'));
        return;
      }
      const removed = room.removeAllBots();
      socket.emit('publicState', room.state.toPublicState());
      logClient('dashboard', 'clearBots OK', socket.id, { roomId: code, removed });
    } catch (err: any) {
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('kickPlayer', (roomId: string, playerId: string) => {
    try {
      const code = normalizeRoomCode(roomId);
      const targetId = playerId?.trim();
      if (!targetId) {
        socket.emit('error', formatSocketError('Identificador de jugador requerido.', 'invalid_player_id'));
        return;
      }
      const room = RoomManager.getRoom(code);
      if (!room) {
        socket.emit('error', formatSocketError('Sala no encontrada.', 'room_not_found'));
        return;
      }
      const kicked = room.kickPlayer(targetId);
      if (kicked.socketId) {
        const targetSocket = gameNs.sockets.get(kicked.socketId);
        if (targetSocket) {
          (targetSocket.data as { leavingVoluntarily?: boolean }).leavingVoluntarily = true;
          targetSocket.emit('playerKicked', code, {
            playerId: kicked.playerId,
            playerName: kicked.playerName,
            reason: 'host_kick',
          });
          targetSocket.leave(code);
        }
      }
      socket.emit('publicState', room.state.toPublicState());
      logClient('dashboard', 'kickPlayer OK', socket.id, {
        roomId: code,
        playerId: kicked.playerId,
        playerName: kicked.playerName,
        isBot: kicked.isBot,
      });
    } catch (err: any) {
      logger.warn('[dashboard] kickPlayer FAIL', err.message || err);
      const msg = String(err.message || err);
      if (msg.includes('LOBBY')) {
        socket.emit('error', formatSocketError('Solo puedes expulsar en el lobby.', 'kick_not_allowed'));
        return;
      }
      if (msg.includes('no encontrado')) {
        socket.emit('error', formatSocketError('Jugador no encontrado en la sala.', 'player_not_found'));
        return;
      }
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('runBotQaMatch', (roomId: string) => {
    try {
      if (!devBotsEnabled()) {
        socket.emit('error', formatSocketError('Bots desactivados en servidor (DEV_BOTS=false).', 'bots_disabled'));
        return;
      }
      const code = normalizeRoomCode(roomId);
      const room = RoomManager.getRoom(code);
      if (!room) {
        socket.emit('error', formatSocketError('Sala no encontrada.', 'room_not_found'));
        return;
      }
      room.runBotQaMatch();
      socket.emit('publicState', room.state.toPublicState());
      logClient('dashboard', 'runBotQaMatch OK', socket.id, {
        roomId: code,
        phase: room.state.phase,
        players: room.state.players.length,
      });
    } catch (err: any) {
      logger.warn('[dashboard] runBotQaMatch FAIL', err.message || err);
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('disconnect', (reason) => {
    logClient('dashboard', 'disconnected', socket.id, { reason });
  });
}
