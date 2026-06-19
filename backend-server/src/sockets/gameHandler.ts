/**
 * Handlers socket móvil: gameplay en partida activa.
 *
 * Eventos: `playerAction`, `startGame`, `advancePhase`, `submitVote`.
 * Delega validación y mutación de estado a `Room`.
 */
import { Socket } from 'socket.io';
import RoomManager from '../game/RoomManager';
import { logClient } from '../utils/socketLog';
import { logger } from '../utils/logger';

/** Registra handlers de juego en namespace `/game`. */
export default function registerGameHandlers(socket: Socket) {
  socket.on('playerAction', (roomId: string, action: any) => {
    try {
      logClient('mobile', 'playerAction', socket.id, {
        roomId,
        actor: action?.actor,
        type: action?.type,
        target: action?.target,
      });
      const room = RoomManager.getRoom(roomId);
      if (!room) { socket.emit('error', 'room not found'); return; }
      const result = room.submitAction(action);
      if (result.ok) {
        logClient('mobile', 'playerAction accepted', socket.id, { actionId: action.id });
        socket.emit('actionAccepted', action.id);
      } else {
        logger.warn('[mobile] playerAction rejected', { roomId, actor: action?.actor, reason: result.reason });
        socket.emit('error', result.reason);
      }
    } catch (err: any) {
      logger.error('[mobile] playerAction FAIL', err.message || err);
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('startGame', (roomId: string) => {
    try {
      logClient('mobile', 'startGame', socket.id, { roomId });
      const room = RoomManager.getRoom(roomId);
      if (!room) { socket.emit('error', 'room not found'); return; }
      room.startGame();
      logClient('mobile', 'startGame OK', socket.id, { roomId, phase: room.state.phase });
    } catch (err: any) {
      logger.error('[mobile] startGame FAIL', err.message || err);
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('advancePhase', async (roomId: string) => {
    try {
      const room = RoomManager.getRoom(roomId);
      logClient('mobile', 'advancePhase', socket.id, { roomId, from: room?.state.phase });
      if (!room) { socket.emit('error', 'room not found'); return; }
      room.advancePhase()
        .then((next) => {
          logClient('mobile', 'advancePhase OK', socket.id, { roomId, to: next });
        })
        .catch((err: any) => {
          logger.error('[mobile] advancePhase FAIL', err.message || err);
          socket.emit('error', err.message || String(err));
        });
    } catch (err: any) {
      logger.error('[mobile] advancePhase FAIL', err.message || err);
      socket.emit('error', err.message || String(err));
    }
  });

  socket.on('submitVote', (roomId: string, vote: any) => {
    try {
      logClient('mobile', 'submitVote', socket.id, {
        roomId,
        voter: vote?.voter,
        target: vote?.target,
      });
      const room = RoomManager.getRoom(roomId);
      if (!room) { socket.emit('error', 'room not found'); return; }
      const { voter, target } = vote;
      const result = room.submitVote(voter, target ?? null);
      if (!result.ok) {
        logger.warn('[mobile] submitVote rejected', { roomId, voter, reason: result.reason });
        socket.emit('error', result.reason);
      } else {
        logClient('mobile', 'submitVote OK', socket.id, { roomId, voter, target });
      }
    } catch (err: any) {
      logger.error('[mobile] submitVote FAIL', err.message || err);
      socket.emit('error', err.message || String(err));
    }
  });
}
