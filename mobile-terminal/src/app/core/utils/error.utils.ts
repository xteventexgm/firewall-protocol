/** Claves de sesión de partida en localStorage. */
export const GAME_SESSION_KEYS = ['roomCode', 'myPlayerId'] as const;

/** Errores de join/reconnect que invalidan la sesión guardada. */
export const FATAL_JOIN_ERROR_CODES = new Set([
  'room_not_found',
  'game_ended',
  'game_started',
  'room_full',
  'invalid_room_code',
  'invalid_player_id',
  'lobby_closed',
]);

const LEGACY_JOIN_PATTERNS: ReadonlyArray<{ re: RegExp; code: string }> = [
  { re: /room not found|sala no encontrada/i, code: 'room_not_found' },
  { re: /has ended|ya terminó la partida/i, code: 'game_ended' },
  { re: /already started|ya comenzó/i, code: 'game_started' },
  { re: /room is full|sala llena/i, code: 'room_full' },
  { re: /invalid room|código de sala inválido/i, code: 'invalid_room_code' },
];

const JOIN_ERROR_MESSAGES: Record<string, string> = {
  room_not_found: 'Sala no encontrada. Verifica el código con el host.',
  game_ended: 'Esta partida ya terminó. Pide un código nuevo.',
  game_started: 'La partida ya comenzó. No puedes unirte ahora.',
  room_full: 'Sala llena. Espera a que alguien salga o pide otra sala.',
  invalid_room_code: 'Código inválido. Debe ser FIRE-XXXX.',
  invalid_player_id: 'Sesión corrupta. Vuelve a ingresar tu alias.',
  lobby_closed: 'El host cerró la sala. Escanea un código nuevo para jugar.',
  email_not_verified: 'Verifica tu correo antes de unirte. Revisa tu bandeja o pega el código en tu perfil.',
};

const CHAT_ERROR_MESSAGES: Record<string, string> = {
  rate_limit: 'Espera unos segundos antes de enviar otro mensaje.',
  rate_burst: 'Demasiados mensajes. Pausa un momento.',
  chat_disabled: 'El chat está desactivado en esta fase.',
  empty_message: 'Escribe un mensaje antes de enviar.',
  channel_denied: 'No tienes acceso a ese canal.',
};

/** Mensaje legible del evento `error` del backend (incluye código entre paréntesis). */
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

export function formatServerErrorForToast(msg: string): string {
  if (msg === 'lobby_closed' || msg === 'error (lobby_closed)') {
    return JOIN_ERROR_MESSAGES['lobby_closed'];
  }
  const { message, code } = parseServerErrorMessage(msg);
  if (code && JOIN_ERROR_MESSAGES[code]) {
    return JOIN_ERROR_MESSAGES[code];
  }
  if (code && CHAT_ERROR_MESSAGES[code]) {
    return CHAT_ERROR_MESSAGES[code];
  }
  const inferred = inferJoinErrorCode(message);
  if (inferred && JOIN_ERROR_MESSAGES[inferred]) {
    return JOIN_ERROR_MESSAGES[inferred];
  }
  return message;
}

/** Segundos de cooldown sugeridos tras error de chat rate_limit. */
export function parseChatCooldownSeconds(msg: string): number | null {
  const { code } = parseServerErrorMessage(msg);
  if (code === 'rate_limit' || msg.includes('rate_limit')) {
    const match = msg.match(/(\d+)s/);
    return match ? parseInt(match[1], 10) : 3;
  }
  if (code === 'rate_burst' || msg.includes('rate_burst')) {
    return 15;
  }
  return null;
}

/** Limpia sesión de sala tras game over o error fatal de join (conserva playerName). */
export function clearGameSessionStorage(): void {
  for (const key of GAME_SESSION_KEYS) {
    localStorage.removeItem(key);
  }
}
