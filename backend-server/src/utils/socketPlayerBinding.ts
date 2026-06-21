/**
 * Vincula socket ↔ jugador para evitar suplantación de acciones/votos/chat.
 */
import { Socket } from 'socket.io';

export interface SocketPlayerData {
  playerId?: string;
  roomId?: string;
  leavingVoluntarily?: boolean;
}

export function bindPlayerToSocket(socket: Socket, roomId: string, playerId: string): void {
  const data = socket.data as SocketPlayerData;
  data.roomId = roomId.trim().toUpperCase();
  data.playerId = playerId;
}

export function getBoundPlayerId(socket: Socket): string | undefined {
  return (socket.data as SocketPlayerData).playerId;
}

export function getBoundRoomId(socket: Socket): string | undefined {
  return (socket.data as SocketPlayerData).roomId;
}

/** Verifica que el actor del evento coincide con el jugador del socket. */
export function assertSocketActor(socket: Socket, actorId: string, roomId: string): string | null {
  const bound = getBoundPlayerId(socket);
  const boundRoom = getBoundRoomId(socket);
  if (!bound) return 'Debes unirte a la sala antes de actuar (not_joined)';
  if (bound !== actorId) return 'No puedes actuar por otro jugador (identity_mismatch)';
  if (boundRoom && boundRoom !== roomId.trim().toUpperCase()) {
    return 'Sala no coincide con tu sesión (room_mismatch)';
  }
  return null;
}
