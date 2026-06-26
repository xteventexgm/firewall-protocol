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
import { ransomwareCooldownNights, MINER_MAX_SHIELDS } from './balance';

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
  | 'zero_day_already_used'
  | 'self_target'
  | 'invalid_redirect'
  | 'invalid_swap'
  | 'patch_already_used'
  | 'no_shields_left'
  | 'shields_at_max'
  | 'miner_target_cooldown';

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

  if (role === RoleName.SYSADMIN) {
    return 'invalid_action_type';
  }

  if (!allowed.includes(type)) return 'invalid_action_type';

  if (type === 'troll_provoke') {
    if (meta.trollProvokeUsedTonight) return 'already_acted';
    if (!action.meta?.messageIndex && action.meta?.messageIndex !== 0) return 'invalid_target';
    return null;
  }

  if (type === 'noise_burst') {
    if (meta.trollProvokeUsedTonight) return 'already_acted';
    if (!action.meta?.messageIndex && action.meta?.messageIndex !== 0) return 'invalid_target';
    return null;
  }

  if (type === 'mirage_cloak' || type === 'jam_hacker') {
    return null;
  }

  if (type === 'intel_pulse') {
    if (meta.intelPulseUsed) return 'no_uses_left';
    return null;
  }

  if (type === 'backup_mark') {
    if ((meta.backupMarkUsesLeft ?? 0) <= 0) return 'no_uses_left';
  }

  if (type !== 'hacker_vote' && type !== 'bgp_swap' && type !== 'chaos_route' && type !== 'intel_pulse' && type !== 'mirage_cloak' && type !== 'jam_hacker' && type !== 'troll_provoke' && type !== 'noise_burst' && !action.target) {
    return 'invalid_target';
  }

  if (type === 'bgp_swap') {
    const swapWith = action.meta?.swapWith;
    if (!action.target || !swapWith) return 'invalid_target';
    if (action.target === swapWith) return 'invalid_swap';
    if (action.target === action.actor || swapWith === action.actor) return 'self_target';
    const t1 = state.getPlayer(action.target);
    const t2 = state.getPlayer(swapWith);
    if (!t1?.isAlive || !t2?.isAlive) return 'invalid_target';
  }

  if (type === 'chaos_route') {
    const routeTo = action.meta?.routeTo;
    if (!action.target || !routeTo) return 'invalid_target';
    if (action.target === routeTo) return 'invalid_swap';
    if (action.target === action.actor || routeTo === action.actor) return 'self_target';
    const t1 = state.getPlayer(action.target);
    const t2 = state.getPlayer(routeTo);
    if (!t1?.isAlive || !t2?.isAlive) return 'invalid_target';
  }

  if (type === 'phisher_redirect') {
    const redirectTo = action.meta?.redirectTo;
    if (!redirectTo) return 'invalid_redirect';
    const dest = state.getPlayer(redirectTo);
    if (!dest?.isAlive) return 'invalid_redirect';
  }

  if (type === 'mitm_hijack') {
    const hijackTo = action.meta?.hijackTo;
    if (!hijackTo) return 'invalid_redirect';
    const hacker = state.getPlayer(action.target!);
    const dest = state.getPlayer(hijackTo);
    if (!hacker?.isAlive || hacker.team !== Team.BLACK_HAT) return 'invalid_target';
    if (!dest?.isAlive) return 'invalid_redirect';
  }

  if (type === 'crypto_bribe') {
    if ((meta.shieldCharges ?? 0) <= 0) return 'no_shields_left';
  }

  if (type === 'mine_crypto') {
    if ((meta.shieldCharges ?? 0) >= MINER_MAX_SHIELDS) return 'shields_at_max';
    if (meta.lastMinedTarget && meta.lastMinedTarget === action.target) return 'miner_target_cooldown';
  }

  const selfTargetTypes = ['pentester_kill', 'brute_force', 'ransomware', 'worm_infect', 'worm_kill', 'freeze', 'scan', 'spy', 'protect', 'cure', 'honeypot_drag', 'mine_crypto', 'crypto_bribe', 'ids_watch', 'patch_harden', 'exploit_strip', 'shadow_mask', 'logic_bomb', 'data_leak', 'team_probe', 'forensic_trace', 'backup_mark', 'threat_hunt', 'incident_clear', 'waf_block', 'backdoor_plant', 'lateral_probe', 'vote_trace', 'vuln_scan', 'cred_probe', 'dns_spoof', 'rigged_payload', 'ransom_note'];
  if (selfTargetTypes.includes(type) && action.target === action.actor) {
    return 'self_target';
  }

  if (type === 'pentester_kill') {
    if ((meta.pentesterUsesLeft ?? 0) <= 0) return 'no_uses_left';
  }

  if (type === 'brute_force') {
    if ((meta.bruteForceUsesLeft ?? 0) <= 0) return 'no_uses_left';
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
  if (type === 'brute_force') {
    meta.bruteForceUsesLeft = Math.min(1, (meta.bruteForceUsesLeft ?? 0) + 1);
  }
  if (type === 'backup_mark') {
    meta.backupMarkUsesLeft = Math.min(1, (meta.backupMarkUsesLeft ?? 0) + 1);
  }
  if (type === 'intel_pulse') {
    meta.intelPulseUsed = false;
  }
  if (type === 'crypto_bribe') {
    meta.shieldCharges = (meta.shieldCharges ?? 0) + 1;
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
  if (actionType === 'brute_force') {
    meta.bruteForceUsesLeft = Math.max(0, (meta.bruteForceUsesLeft ?? 0) - 1);
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
  if (actionType === 'troll_provoke' || actionType === 'noise_burst') {
    meta.trollProvokeUsedTonight = true;
  }
  if (actionType === 'backup_mark') {
    meta.backupMarkUsesLeft = Math.max(0, (meta.backupMarkUsesLeft ?? 0) - 1);
  }
  if (actionType === 'intel_pulse') {
    meta.intelPulseUsed = true;
  }
  if (actionType === 'crypto_bribe') {
    meta.shieldCharges = Math.max(0, (meta.shieldCharges ?? 0) - 1);
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
  self_target: 'No puedes seleccionarte a ti mismo como objetivo',
  invalid_redirect: 'Destino de redirección no válido',
  invalid_swap: 'Los nodos del intercambio BGP deben ser distintos',
  patch_already_used: 'Ya usaste el parche de emergencia en esta partida',
  no_shields_left: 'No tienes escudos para un soborno cripto',
  shields_at_max: 'Ya tienes el máximo de escudos (3)',
  miner_target_cooldown: 'No puedes minar el mismo nodo dos noches seguidas',
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
