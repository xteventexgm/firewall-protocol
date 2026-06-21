/** Errores de join/reconnect que invalidan la sesión del dashboard. */
export const FATAL_JOIN_ERROR_CODES = new Set([
  'room_not_found',
  'game_ended',
  'invalid_room_code',
]);

const LEGACY_JOIN_PATTERNS: ReadonlyArray<{ re: RegExp; code: string }> = [
  { re: /room not found|sala no encontrada/i, code: 'room_not_found' },
  { re: /has ended|ya terminó la partida/i, code: 'game_ended' },
  { re: /invalid room|código de sala inválido/i, code: 'invalid_room_code' },
  { re: /create a lobby first/i, code: 'room_not_found' },
];

const JOIN_ERROR_MESSAGES: Record<string, string> = {
  room_not_found: 'Sala no encontrada. Crea un lobby o verifica el código.',
  game_ended: 'Esta partida ya terminó. Crea una sala nueva.',
  invalid_room_code: 'Código inválido. Debe ser FIRE-XXXX.',
  not_enough_players: 'Faltan jugadores para iniciar.',
  wrong_phase: 'Acción no permitida en esta fase.',
};

export function parseServerErrorMessage(msg: string): { message: string; code?: string } {
  const match = msg.match(/^(.+?)\s*\(([\w_]+)\)\s*$/);
  if (match) {
    return { message: match[1].trim(), code: match[2] };
  }
  return { message: msg };
}

export function inferJoinErrorCode(message: string): string | undefined {
  for (const { re, code } of LEGACY_JOIN_PATTERNS) {
    if (re.test(message)) return code;
  }
  return undefined;
}

export function isFatalJoinError(code?: string, message?: string): boolean {
  const resolved = code ?? (message ? inferJoinErrorCode(message) : undefined);
  return resolved ? FATAL_JOIN_ERROR_CODES.has(resolved) : false;
}

export function isJoinPendingError(code?: string, message?: string): boolean {
  const resolved = code ?? (message ? inferJoinErrorCode(message) : undefined);
  return !!resolved && FATAL_JOIN_ERROR_CODES.has(resolved);
}

export function formatServerErrorForToast(msg: string): string {
  const { message, code } = parseServerErrorMessage(msg);
  if (code && JOIN_ERROR_MESSAGES[code]) {
    return JOIN_ERROR_MESSAGES[code];
  }
  const inferred = inferJoinErrorCode(message);
  if (inferred && JOIN_ERROR_MESSAGES[inferred]) {
    return JOIN_ERROR_MESSAGES[inferred];
  }
  return message;
}
