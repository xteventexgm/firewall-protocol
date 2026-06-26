/**
 * Códigos de error socket unificados (join, lobby, acciones).
 * Formato emitido: "Mensaje legible (codigo)"
 */
export type SocketErrorCode =
  | 'room_not_found'
  | 'room_full'
  | 'game_ended'
  | 'game_started'
  | 'invalid_room_code'
  | 'invalid_player_id'
  | 'room_already_exists'
  | 'room_code_used'
  | 'wrong_phase'
  | 'not_enough_players'
  | 'dashboard_only'
  | 'not_joined'
  | 'identity_mismatch'
  | 'room_mismatch'
  | 'bots_disabled'
  | 'bots_need_humans'
  | 'player_not_found'
  | 'kick_not_allowed';

export function formatSocketError(message: string, code: SocketErrorCode): string {
  return `${message} (${code})`;
}

/** Código de sala esperado: FIRE- + 4 alfanuméricos. */
const ROOM_CODE_RE = /^FIRE-[A-Z0-9]{4}$/;

export function normalizeRoomCode(roomId: string): string {
  return roomId.trim().toUpperCase();
}

export function isValidRoomCode(roomId: string): boolean {
  return ROOM_CODE_RE.test(normalizeRoomCode(roomId));
}
