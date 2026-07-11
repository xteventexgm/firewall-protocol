/**
 * Handlers socket móvil: gameplay en partida activa.
 */
import { Socket } from 'socket.io';
import RoomManager from '../game/RoomManager';
import { logClient } from '../utils/socketLog';
import { logger } from '../utils/logger';
import { assertSocketActor } from '../utils/socketPlayerBinding';

import { formatSocketError } from '../utils/socketErrors';

export default function registerGameHandlers(socket: Socket) {
  socket.on('playerAction', (roomId: string, action: any) => {
    try {
      const code = roomId.trim().toUpperCase();
      const authErr = assertSocketActor(socket, action?.actor, code);
      if (authErr) { socket.emit('error', authErr); return; }

      logClient('mobile', 'playerAction', socket.id, {
        roomId: code,
        actor: action?.actor,
        type: action?.type,
        target: action?.target,
      });
      const room = RoomManager.getRoom(code);
      if (!room) { socket.emit('error', 'Sala no encontrada (room_not_found)'); return; }
      const result = room.submitAction(action);
      if (result.ok) {
        logClient('mobile', 'playerAction accepted', socket.id, { actionId: action.id });
        socket.emit('actionAccepted', action.id);
      } else {
        logger.warn('[mobile] playerAction rejected', { roomId: code, actor: action?.actor, reason: result.reason });
        socket.emit('error', result.reason);
      }
    } catch (err: any) {
      logger.error('[mobile] playerAction FAIL', err.message || err);
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('requestMinigame', (roomId: string, playerId: string) => {
    try {
      const code = roomId.trim().toUpperCase();
      const authErr = assertSocketActor(socket, playerId, code);
      if (authErr) { socket.emit('error', authErr); return; }
      const room = RoomManager.getRoom(code);
      if (!room) { socket.emit('error', 'Sala no encontrada'); return; }
      room.requestMinigame(playerId);
    } catch (err: any) {
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('submitMinigameAnswer', (roomId: string, payload: { playerId: string; token: string; answer: string | number }) => {
    try {
      const code = roomId.trim().toUpperCase();
      const authErr = assertSocketActor(socket, payload?.playerId, code);
      if (authErr) { socket.emit('error', authErr); return; }
      const room = RoomManager.getRoom(code);
      if (!room) { socket.emit('error', 'Sala no encontrada'); return; }
      const result = room.submitMinigameAnswer(payload.playerId, payload.token, payload.answer);
      if (!result.ok) socket.emit('error', result.reason);
    } catch (err: any) {
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('skipMinigame', (roomId: string, payload: { playerId: string; token: string }) => {
    try {
      const code = roomId.trim().toUpperCase();
      const authErr = assertSocketActor(socket, payload?.playerId, code);
      if (authErr) { socket.emit('error', authErr); return; }
      const room = RoomManager.getRoom(code);
      if (!room) { socket.emit('error', 'Sala no encontrada'); return; }
      room.skipMinigame(payload.playerId, payload.token);
    } catch (err: any) {
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('submitChat', (roomId: string, payload: { playerId: string; text: string; channel?: string; type?: 'normal'|'reaction'|'last_will'; targetPlayerId?: string }) => {
    try {
      const code = roomId.trim().toUpperCase();
      const authErr = assertSocketActor(socket, payload?.playerId, code);
      if (authErr) { socket.emit('error', authErr); return; }
      const room = RoomManager.getRoom(code);
      if (!room) { socket.emit('error', 'Sala no encontrada'); return; }
      const result = room.submitChat(
        payload.playerId,
        payload.text,
        payload.channel as 'public' | 'dead' | 'hacker' | undefined,
        payload.type,
        payload.targetPlayerId
      );
      if (!result.ok) socket.emit('error', result.reason);
    } catch (err: any) {
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('submitDayAction', (roomId: string, payload: { actor: string; type: string; target?: string }) => {
    try {
      const code = roomId.trim().toUpperCase();
      const authErr = assertSocketActor(socket, payload?.actor, code);
      if (authErr) { socket.emit('error', authErr); return; }
      const room = RoomManager.getRoom(code);
      if (!room) { socket.emit('error', 'Sala no encontrada'); return; }
      const result = room.submitDayAction(payload.actor, payload.type, payload.target);
      if (!result.ok) socket.emit('error', result.reason);
    } catch (err: any) {
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('setPlayerReady', (roomId: string, payload: { playerId: string; isReady: boolean }) => {
    try {
      logger.info(`[setPlayerReady] called by ${socket.id} with roomId=${roomId} payload=`, payload);
      const code = roomId.trim().toUpperCase();
      const authErr = assertSocketActor(socket, payload?.playerId, code);
      if (authErr) { 
        logger.error(`[setPlayerReady] auth error: ${authErr}`);
        socket.emit('error', authErr); 
        return; 
      }
      const room = RoomManager.getRoom(code);
      if (!room) { 
        logger.error(`[setPlayerReady] room not found: ${code}`);
        socket.emit('error', 'Sala no encontrada'); 
        return; 
      }
      const result = room.setPlayerReady(payload.playerId, payload.isReady);
      if (!result.ok) {
        logger.error(`[setPlayerReady] result not ok: ${result.reason}`);
        socket.emit('error', result.reason);
      } else {
        logger.info(`[setPlayerReady] success for ${payload.playerId}`);
      }
    } catch (err: any) {
      logger.error(`[setPlayerReady] exception: ${err.message}`);
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('startGame', (_roomId: string) => {
    logger.warn('[mobile] startGame rechazado — solo el dashboard puede iniciar');
    socket.emit(
      'error',
      formatSocketError('Solo el dashboard puede iniciar la partida.', 'dashboard_only'),
    );
  });

  socket.on('advancePhase', (_roomId: string) => {
    logger.warn('[mobile] advancePhase rechazado — solo el dashboard puede avanzar fases');
    socket.emit(
      'error',
      formatSocketError('Solo el dashboard puede avanzar fases.', 'dashboard_only'),
    );
  });

  socket.on('submitVote', (roomId: string, vote: any) => {
    try {
      const code = roomId.trim().toUpperCase();
      const authErr = assertSocketActor(socket, vote?.voter, code);
      if (authErr) { socket.emit('error', authErr); return; }

      logClient('mobile', 'submitVote', socket.id, {
        roomId: code,
        voter: vote?.voter,
        target: vote?.target,
      });
      const room = RoomManager.getRoom(code);
      if (!room) { socket.emit('error', 'Sala no encontrada'); return; }
      const { voter, target } = vote;
      const result = room.submitVote(voter, target ?? null);
      if (!result.ok) {
        logger.warn('[mobile] submitVote rejected', { roomId: code, voter, reason: result.reason });
        socket.emit('error', result.reason);
      } else {
        logClient('mobile', 'submitVote OK', socket.id, { roomId: code, voter, target });
      }
    } catch (err: any) {
      logger.error('[mobile] submitVote FAIL', err.message || err);
      socket.emit('error', err.message || String(err));
    }
  });
}
