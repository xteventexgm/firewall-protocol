import { PlayerAction, GamePhase, SoloWinner } from '../types';
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
  if (meta.actedThisNight) return 'already_acted';

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
}

export function getHackerTeam(state: GameStateModel): string[] {
  return state.players
    .filter(p => p.isAlive && p.team === Team.BLACK_HAT)
    .map(p => p.id);
}
