/**
 * Handlers socket móvil: unirse/reconectar/salir de sala.
 *
 * Eventos entrantes: `joinRoom`, `leaveRoom`, `reconnectPlayer`.
 * Tras join exitoso emite `roomState` y adjunta bridge si hace falta.
 */
import { Socket, Namespace } from 'socket.io';
import RoomManager, { RoomClosedError } from '../game/RoomManager';
import { RoomJoinDeniedError } from '../game/Room';
import { Player } from '../models/PlayerProfile';
import { logClient } from '../utils/socketLog';
import { logger } from '../utils/logger';
import { bindPlayerToSocket } from '../utils/socketPlayerBinding';
import database from '../config/database';
import { GamePhase } from '../types';
import {
  formatSocketError,
  isValidRoomCode,
  normalizeRoomCode,
} from '../utils/socketErrors';
import { verifyAccessToken, findUserById, findUserByGuestId, isEmailVerified } from '@firewall/identity-service';
import { REQUIRE_EMAIL_VERIFICATION } from '../config/env';

/** Registra handlers de lobby/conexión en namespace `/game`. */
export default function registerRoomHandlers(socket: Socket, gameNs: Namespace, dashboardNs: Namespace) {
  logClient('mobile', 'connected', socket.id);

  socket.on('joinRoom', (roomId: string, playerId: string, name?: string, opts?: { autoReconnect?: boolean; accessToken?: string }) => {
    void (async () => {
    try {
      const code = normalizeRoomCode(roomId);
      const autoReconnect = opts?.autoReconnect === true;
      let linkedUserId: string | undefined = opts?.userId; // MODO CRUDO: Tomamos el ID directo
      let avatarUrl: string | undefined;

      // Si no nos pasaron userId en crudo, intentamos decodificar el token
      if (!linkedUserId && opts?.accessToken) {
        const payload = verifyAccessToken(opts.accessToken);
        linkedUserId = payload?.sub;
      }
      
      let doc;
      console.log(`[DEBUG JOIN] playerId=${playerId}, opts.userId=${opts?.userId}, opts.accessToken?=${!!opts?.accessToken}`);
      if (linkedUserId) {
        doc = await findUserById(linkedUserId);
        console.log(`[DEBUG JOIN] Found by linkedUserId (${linkedUserId}):`, !!doc);
      } else if (playerId.startsWith('usr_')) {
        doc = await findUserByGuestId(playerId);
        console.log(`[DEBUG JOIN] Found by guestId (${playerId}):`, !!doc);
        if (doc) linkedUserId = doc._id.toString();
      }

      if (doc) {
        avatarUrl = doc.avatarUrl;
        if (avatarUrl?.startsWith('/api/media/avatars/')) {
          avatarUrl = avatarUrl.replace(/^\/api\/media/, '/api/auth');
        }
        if (REQUIRE_EMAIL_VERIFICATION && !isEmailVerified(doc)) {
          logger.warn('[mobile] joinRoom — correo no verificado', { roomId: code, playerId, linkedUserId });
          socket.emit(
            'error',
            formatSocketError(
              'Debes verificar tu correo antes de unirte a una sala.',
              'email_not_verified',
            ),
          );
          return;
        }
      }

      logClient('mobile', 'joinRoom', socket.id, { roomId: code, playerId, name, autoReconnect, linkedUserId: linkedUserId ?? null });

      if (!isValidRoomCode(code)) {
        socket.emit(
          'error',
          formatSocketError('Código de sala inválido. Usa el formato FIRE-XXXX.', 'invalid_room_code'),
        );
        return;
      }

      if (!playerId?.trim()) {
        socket.emit(
          'error',
          formatSocketError('Identificador de jugador requerido.', 'invalid_player_id'),
        );
        return;
      }

      let room;
      try {
        room = RoomManager.getOrRestoreRoom(code, gameNs, dashboardNs);
      } catch (err) {
        if (err instanceof RoomClosedError) {
          logger.warn('[mobile] joinRoom — sala terminada', { roomId: code, playerId });
          socket.emit(
            'error',
            formatSocketError(`La sala ${code} ya terminó la partida.`, 'game_ended'),
          );
          return;
        }
        throw err;
      }

      if (!room) {
        logger.warn('[mobile] joinRoom — sala no existe', { roomId: code, playerId });
        socket.emit(
          'error',
          formatSocketError('Sala no encontrada. Pide al host un código válido.', 'room_not_found'),
        );
        return;
      }

      if (!room.state.getPlayer(playerId) && room.state.players.length >= room.state.maxPlayers) {
        logger.warn('[mobile] joinRoom — sala llena', {
          roomId: code,
          playerId,
          players: room.state.players.length,
          maxPlayers: room.state.maxPlayers,
        });
        socket.emit(
          'error',
          formatSocketError(
            `Sala llena (${room.state.players.length}/${room.state.maxPlayers} jugadores).`,
            'room_full',
          ),
        );
        return;
      }

      const existing = room.state.getPlayer(playerId);
      if (existing) {
        if (existing.socketId === socket.id && existing.isConnected) {
          socket.join(code);
          bindPlayerToSocket(socket, code, playerId);
          (socket.data as { leavingVoluntarily?: boolean }).leavingVoluntarily = false;
          socket.emit('roomState', code, room.state.toPlainForPlayer(playerId));
          logClient('mobile', 'joinRoom noop (ya conectado)', socket.id, { roomId: code, playerId });
          return;
        }

        const previousSocketId = existing.socketId;
        const isInvoluntaryReconnect =
          autoReconnect &&
          !existing.isConnected &&
          existing.lastDisconnectReason === 'transport';
        if (isInvoluntaryReconnect) {
          room.reconnectPlayer(playerId, socket.id, name, linkedUserId, avatarUrl);
        } else {
          room.connectPlayer(playerId, socket.id, name, linkedUserId, avatarUrl);
        }
        if (previousSocketId && previousSocketId !== socket.id) {
          const oldSock = gameNs.sockets.get(previousSocketId);
          if (oldSock) {
            (oldSock.data as { leavingVoluntarily?: boolean }).leavingVoluntarily = true;
            oldSock.disconnect(true);
          }
        }
        logClient('mobile', isInvoluntaryReconnect ? 'joinRoom reconnect' : 'joinRoom rejoin', socket.id, {
          roomId: code,
          playerId,
        });
      } else {
        const p = new Player(playerId, name || `Player-${playerId}`, socket.id);
        if (linkedUserId) p.userId = linkedUserId;
        if (avatarUrl) p.avatarUrl = avatarUrl;
        try {
          room.addPlayer(p);
        } catch (err) {
          if (err instanceof RoomJoinDeniedError) {
            logger.warn('[mobile] joinRoom — partida en curso', { roomId: code, playerId, phase: room.state.phase });
            socket.emit(
              'error',
              formatSocketError(
                'La partida ya comenzó. No se admiten jugadores nuevos.',
                'game_started',
              ),
            );
            return;
          }
          if (err instanceof Error && err.message.includes('full')) {
            socket.emit(
              'error',
              formatSocketError(
                `Sala llena (máx. ${room.state.maxPlayers} jugadores).`,
                'room_full',
              ),
            );
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
      bindPlayerToSocket(socket, code, playerId);
      (socket.data as { leavingVoluntarily?: boolean }).leavingVoluntarily = false;
      socket.emit('roomState', code, room.state.toPlainForPlayer(playerId));
      logClient('mobile', 'joinRoom OK', socket.id, {
        roomId: code,
        phase: room.state.phase,
        players: room.state.players.length,
      });
    } catch (err: any) {
      logger.error('[mobile] joinRoom FAIL', err.message || err);
      socket.emit('error', err.message || String(err));
    }
    })();
  });

  socket.on('leaveRoom', (roomId: string, playerId: string) => {
    try {
      const code = normalizeRoomCode(roomId);
      logClient('mobile', 'leaveRoom', socket.id, { roomId: code, playerId });
      const room = RoomManager.getRoom(code);
      if (!room) {
        socket.emit('error', formatSocketError('Sala no encontrada.', 'room_not_found'));
        return;
      }

      const phase = room.state.phase;
      (socket.data as { leavingVoluntarily?: boolean }).leavingVoluntarily = true;
      if (phase === GamePhase.LOBBY) {
        room.removePlayer(playerId);
        socket.leave(code);
      } else {
        room.voluntaryLeave(playerId);
        socket.leave(code);
      }
      logClient('mobile', 'leaveRoom OK', socket.id, { roomId: code, playerId, phase });
    } catch (err: any) {
      logger.error('[mobile] leaveRoom FAIL', err.message || err);
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('createRoom', () => {
    logger.warn('[mobile] createRoom rechazado — solo el dashboard puede crear salas');
    socket.emit(
      'error',
      formatSocketError('Solo el dashboard puede crear salas.', 'dashboard_only'),
    );
  });

  socket.on('disconnect', (reason) => {
    logClient('mobile', 'disconnected', socket.id, { reason });
  });
}
