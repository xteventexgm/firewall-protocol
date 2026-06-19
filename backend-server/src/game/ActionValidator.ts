/**
 * Valida acciones nocturnas antes de encolarlas en `GameStateModel.actionQueue`.
 *
 * Reglas: fase NOCHE, actor vivo, no silenciado/congelado, una acción/noche,
 * tipo acorde al rol, cooldowns y usos (Pentester, Antivirus, Ransomware, Zero-Day).
 *
 * Errores legibles para móvil vía `formatActionValidationError`.
 */
import { PlayerAction, GamePhase } from '../types';
import { ROLE_NIGHT_ACTIONS } from '../types/player-metadata.types';
import { RoleName, Team } from '../types/roles.types';
import { GameStateModel } from '../models/GameState';
import { Player } from '../models/PlayerProfile';
import { getMeta, isSilenced } from './playerMetadata';
import { ransomwareCooldownNights } from './balance';

/** Códigos de error machine-readable (también en mensaje al cliente entre paréntesis). */
export type ActionValidationError =
  | 'wrong_phase'
  | 'actor_not_found'
  | 'actor_dead'
  | 'actor_silenced'
  | 'actor_frozen'
  | 'already_acted'
  | 'invalid_action_type'
  | 'no_uses_left'
  | 'antivirus_cooldown'
  | 'antivirus_cure_cooldown'
  | 'ransomware_cooldown'
  | 'invalid_target'
  | 'role_mismatch'
  | 'zero_day_already_used';

/** Valida acción entrante; retorna null si es aceptable. */
export function validateNightAction(
  action: PlayerAction,
  state: GameStateModel,
  phase: GamePhase,
  frozenActors: Set<string> = new Set(),
): ActionValidationError | null {
  if (phase !== GamePhase.NOCHE) return 'wrong_phase';

  const actor = state.getPlayer(action.actor);
  if (!actor) return 'actor_not_found';
  if (!actor.isAlive) return 'actor_dead';
  if (isSilenced(actor, state.dayNumber)) return 'actor_silenced';
  if (frozenActors.has(action.actor)) return 'actor_frozen';

  const meta = getMeta(actor);
  const replacingQueued = state.actionQueue.some(a => a.actor === action.actor);
  if (meta.actedThisNight && !replacingQueued) return 'already_acted';

  const role = actor.role as RoleName | undefined;
  if (!role) return 'role_mismatch';
  if (action.role && action.role !== role) return 'role_mismatch';

  const allowed = ROLE_NIGHT_ACTIONS[role] ?? [];
  const type = (action.type || '').toLowerCase();

  if (role === RoleName.SYSADMIN || role === RoleName.TROLL || role === RoleName.CRYPTO_MINER) {
    return 'invalid_action_type';
  }

  if (!allowed.includes(type)) return 'invalid_action_type';

  if (type !== 'hacker_vote' && type !== 'bgp_swap' && !action.target) return 'invalid_target';

  if (type === 'bgp_swap' && (!action.target || !action.meta?.swapWith)) return 'invalid_target';

  if (type === 'pentester_kill') {
    if ((meta.pentesterUsesLeft ?? 0) <= 0) return 'no_uses_left';
  }

  if (type === 'ransomware') {
    if ((meta.ransomwareCooldown ?? 0) > 0) return 'ransomware_cooldown';
  }

  if (type === 'protect') {
    if (meta.lastProtectedTarget && meta.lastProtectedTarget === action.target) {
      return 'antivirus_cooldown';
    }
  }

  if (type === 'cure') {
    if (meta.lastCuredTarget && meta.lastCuredTarget === action.target) {
      return 'antivirus_cure_cooldown';
    }
  }

  if (type === 'zero_day_assume') {
    if (meta.assumedFromPlayerId) return 'zero_day_already_used';
    const target = state.getPlayer(action.target!);
    if (!target || target.isAlive) return 'invalid_target';
  }

  if (action.target && type !== 'zero_day_assume') {
    const target = state.getPlayer(action.target);
    if (!target?.isAlive) return 'invalid_target';
  }

  return null;
}

/** Deshace metadata consumida si se retira acción de la cola antes de resolver noche. */
export function revertQueuedActionMetadata(actor: Player, actionType: string, targetId?: string | null) {
  const meta = getMeta(actor);
  const type = (actionType || '').toLowerCase();

  if (type === 'protect' && meta.lastProtectedTarget === (targetId ?? null)) {
    meta.lastProtectedTarget = null;
  }
  if (type === 'cure' && meta.lastCuredTarget === (targetId ?? null)) {
    meta.lastCuredTarget = null;
  }
  if (type === 'pentester_kill') {
    meta.pentesterUsesLeft = Math.min(2, (meta.pentesterUsesLeft ?? 0) + 1);
  }
}

/** Marca metadata post-validación (cooldowns, usos, flags de noche) al encolar acción. */
export function markActionSubmitted(
  actor: Player,
  actionType: string,
  targetId?: string | null,
  playerCount?: number,
) {
  const meta = getMeta(actor);
  meta.actedThisNight = true;

  if (actionType === 'pentester_kill') {
    meta.pentesterUsesLeft = Math.max(0, (meta.pentesterUsesLeft ?? 0) - 1);
  }
  if (actionType === 'ransomware') {
    meta.ransomwareCooldown = ransomwareCooldownNights(playerCount ?? 15);
  }
  if (actionType === 'protect') {
    meta.lastProtectedTarget = targetId ?? null;
  }
  if (actionType === 'cure') {
    meta.lastCuredTarget = targetId ?? null;
  }
}

const ACTION_VALIDATION_MESSAGES: Record<ActionValidationError, string> = {
  wrong_phase: 'Solo puedes actuar durante la noche (NOCHE)',
  actor_not_found: 'Jugador no encontrado en la sala',
  actor_dead: 'No puedes actuar si estás eliminado',
  actor_silenced: 'Estás silenciado y no puedes actuar esta noche',
  actor_frozen: 'Estás congelado y no puedes actuar esta noche',
  already_acted: 'Ya enviaste una acción esta noche',
  invalid_action_type: 'Acción no válida para tu rol',
  no_uses_left: 'No te quedan usos de esta habilidad',
  antivirus_cooldown: 'No puedes proteger al mismo jugador dos noches seguidas',
  antivirus_cure_cooldown: 'No puedes curar al mismo jugador dos noches seguidas',
  ransomware_cooldown: 'Debes esperar antes de volver a usar Ransomware',
  invalid_target: 'Objetivo no válido',
  role_mismatch: 'El rol indicado no coincide con tu rol asignado',
  zero_day_already_used: 'Ya usaste tu exploit 0-day en esta partida',
};

/** Mensaje legible para el móvil; incluye código entre paréntesis para parsing opcional. */
export function formatActionValidationError(err: ActionValidationError): string {
  const message = ACTION_VALIDATION_MESSAGES[err] ?? 'Acción rechazada';
  return `${message} (${err})`;
}

/** Lista de IDs Black Hat vivos (para evento `hacker_team` al inicio). */
export function getHackerTeam(state: GameStateModel): string[] {
  return state.players
    .filter(p => p.isAlive && p.team === Team.BLACK_HAT)
    .map(p => p.id);
}
