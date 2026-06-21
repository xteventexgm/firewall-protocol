/**
 * Chat de sala con restricciones por fase y canal.
 * - Vivos: público en LOBBY/DIA/VOTACION/FIN
 * - Muertos: solo canal dead (noche, verificación y fases públicas)
 * - Hackers vivos: canal hacker también en NOCHE
 */
import { GamePhase } from '../types';
import { GameStateModel } from '../models/GameState';
import { ChatMessage, ChatChannel } from '../types/events.types';

const MAX_MESSAGES = 120;
const MAX_LENGTH = 120;
export const CHAT_RATE_LIMIT_MS = 3000;
export const CHAT_BURST_PER_MINUTE = 10;

const PUBLIC_CHAT_PHASES: GamePhase[] = [
  GamePhase.LOBBY,
  GamePhase.DIA,
  GamePhase.VOTACION,
  GamePhase.FIN,
];

export type ChatSubmitResult =
  | { ok: true; message: ChatMessage }
  | { ok: false; reason: string };

const DEAD_CHAT_PHASES: GamePhase[] = [
  GamePhase.LOBBY,
  GamePhase.DIA,
  GamePhase.VOTACION,
  GamePhase.NOCHE,
  GamePhase.VERIFICACION,
  GamePhase.FIN,
];

export function canChatInPhase(phase: GamePhase, channel: ChatChannel = 'public'): boolean {
  if (channel === 'hacker') {
    return phase === GamePhase.NOCHE || PUBLIC_CHAT_PHASES.includes(phase);
  }
  if (channel === 'dead') {
    return DEAD_CHAT_PHASES.includes(phase);
  }
  return PUBLIC_CHAT_PHASES.includes(phase);
}

export function countRecentChatByPlayer(state: GameStateModel, playerId: string): number {
  const cutoff = Date.now() - 60_000;
  return (state.chatMessages ?? []).filter(
    (m) => m.playerId === playerId && m.timestamp > cutoff,
  ).length;
}

export function submitChatMessage(
  state: GameStateModel,
  playerId: string,
  text: string,
  channel: ChatChannel = 'public',
  lastSentAt?: number,
): ChatSubmitResult {
  const phase = state.phase;
  const player = state.getPlayer(playerId);
  if (!player) {
    return { ok: false, reason: 'Jugador no encontrado (player_not_found)' };
  }

  const trimmed = (text || '').trim().slice(0, MAX_LENGTH);
  if (!trimmed) {
    return { ok: false, reason: 'Mensaje vacío (empty_message)' };
  }

  const isDead = !player.isAlive;

  if (isDead && channel === 'public') {
    return { ok: false, reason: 'Los eliminados solo pueden usar el chat de espectadores (channel_denied)' };
  }
  if (!isDead && channel === 'dead') {
    return { ok: false, reason: 'Solo los eliminados pueden usar el chat de espectadores (channel_denied)' };
  }

  const resolvedChannel: ChatChannel = isDead ? 'dead' : channel;

  if (!canChatInPhase(phase, resolvedChannel)) {
    return { ok: false, reason: 'El chat está desactivado en esta fase (chat_disabled)' };
  }

  if (resolvedChannel === 'hacker') {
    if (player.team !== 'black_hat' || !player.isAlive) {
      return { ok: false, reason: 'Canal restringido al equipo hacker vivo (channel_denied)' };
    }
  }

  if (lastSentAt && Date.now() - lastSentAt < CHAT_RATE_LIMIT_MS) {
    const waitSec = Math.ceil((CHAT_RATE_LIMIT_MS - (Date.now() - lastSentAt)) / 1000);
    return {
      ok: false,
      reason: `Espera ${waitSec}s antes de enviar otro mensaje (rate_limit)`,
    };
  }

  if (countRecentChatByPlayer(state, playerId) >= CHAT_BURST_PER_MINUTE) {
    return {
      ok: false,
      reason: 'Demasiados mensajes. Espera un momento (rate_burst)',
    };
  }

  const message: ChatMessage = {
    id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    playerId: player.id,
    playerName: player.name,
    text: trimmed,
    channel: resolvedChannel,
    timestamp: Date.now(),
    phase,
  };

  if (!state.chatMessages) state.chatMessages = [];
  state.chatMessages.push(message);
  if (state.chatMessages.length > MAX_MESSAGES) {
    state.chatMessages = state.chatMessages.slice(-MAX_MESSAGES);
  }

  return { ok: true, message };
}

/** Filtra mensajes visibles para un jugador. */
export function getChatForPlayer(
  state: GameStateModel,
  viewerId: string,
): ChatMessage[] {
  const viewer = state.getPlayer(viewerId);
  if (!viewer) return [];

  const isDead = !viewer.isAlive;
  const isHacker = viewer.team === 'black_hat';

  return (state.chatMessages ?? []).filter((m) => {
    if (m.channel === 'public') return true;
    if (m.channel === 'dead' && isDead) return true;
    if (m.channel === 'hacker' && isHacker && viewer.isAlive) return true;
    return false;
  });
}

/** Mensajes públicos para dashboard (sin canal hacker ni dead). */
export function getPublicChat(state: GameStateModel): ChatMessage[] {
  return (state.chatMessages ?? []).filter((m) => m.channel === 'public');
}
