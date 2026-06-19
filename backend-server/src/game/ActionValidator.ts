import { PlayerAction, GamePhase } from '../types';
import { ROLE_NIGHT_ACTIONS } from '../types/player-metadata.types';
import { RoleName, Team } from '../types/roles.types';
import { GameStateModel } from '../models/GameState';
import { Player } from '../models/PlayerProfile';
import { getMeta, isSilenced } from './playerMetadata';

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
  | 'role_mismatch';

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
    const target = state.getPlayer(action.target!);
    if (!target || target.isAlive) return 'invalid_target';
  }

  if (action.target && type !== 'zero_day_assume') {
    const target = state.getPlayer(action.target);
    if (!target?.isAlive) return 'invalid_target';
  }

  return null;
}

/** Deshace marcas de cooldown/usos de una acción encolada que se va a reemplazar. */
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

export function markActionSubmitted(actor: Player, actionType: string, targetId?: string | null) {
  const meta = getMeta(actor);
  meta.actedThisNight = true;

  if (actionType === 'pentester_kill') {
    meta.pentesterUsesLeft = Math.max(0, (meta.pentesterUsesLeft ?? 2) - 1);
  }
  if (actionType === 'ransomware') {
    meta.ransomwareCooldown = 2;
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
};

/** Mensaje legible para el móvil; incluye código entre paréntesis para parsing opcional. */
export function formatActionValidationError(err: ActionValidationError): string {
  const message = ACTION_VALIDATION_MESSAGES[err] ?? 'Acción rechazada';
  return `${message} (${err})`;
}

export function getHackerTeam(state: GameStateModel): string[] {
  return state.players
    .filter(p => p.isAlive && p.team === Team.BLACK_HAT)
    .map(p => p.id);
}
