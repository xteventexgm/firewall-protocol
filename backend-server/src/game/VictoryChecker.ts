import { SoloWinner } from '../types';
import { RoleName, Team, ROLE_CATALOG } from '../types/roles.types';
import { GameStateModel } from '../models/GameState';
import { getMeta } from './playerMetadata';

export type WinResult =
  | { over: true; type: 'team'; winner: Team }
  | { over: true; type: 'solo'; solo: SoloWinner }
  | { over: false };

function checkSoloWin(state: GameStateModel, context: { justVotedOut?: string } = {}): WinResult {
  const alive = state.getAlivePlayers();

  if (context.justVotedOut) {
    const voted = state.getPlayer(context.justVotedOut);
    if (voted?.role === RoleName.TROLL) {
      return {
        over: true,
        type: 'solo',
        solo: { playerId: voted.id, role: RoleName.TROLL, reason: 'troll_banned' },
      };
    }
  }

  if (alive.length === 1) {
    const sole = alive[0];
    if (sole.role === RoleName.WORM) {
      return {
        over: true,
        type: 'solo',
        solo: { playerId: sole.id, role: RoleName.WORM, reason: 'worm_last_standing' },
      };
    }
    if (sole.role === RoleName.CRYPTO_MINER) {
      return {
        over: true,
        type: 'solo',
        solo: { playerId: sole.id, role: RoleName.CRYPTO_MINER, reason: 'miner_survived' },
      };
    }
  }

  return { over: false };
}

function checkTeamWin(state: GameStateModel): WinResult {
  const alive = state.getAlivePlayers();
  const hackers = alive.filter(p => p.team === Team.BLACK_HAT);
  const systemSide = alive.filter(p => p.team === Team.SYSTEM);

  if (hackers.length === 0 && systemSide.length > 0) {
    return { over: true, type: 'team', winner: Team.SYSTEM };
  }

  if (hackers.length > systemSide.length && hackers.length > 0) {
    return { over: true, type: 'team', winner: Team.BLACK_HAT };
  }

  // Zero-Day edge case: asumió rol System y no quedan hackers → victoria System.
  // No hay victoria de equipo caótico (Team.CHAOTIC); roles caóticos ganan en solitario.
  const zeroDay = alive.find(p => p.role === RoleName.ZERO_DAY && getMeta(p).assumedFromPlayerId);
  if (zeroDay && hackers.length === 0) {
    const assumedTeam = zeroDay.team as Team;
    if (assumedTeam === Team.SYSTEM && systemSide.length > 0 && hackers.length === 0) {
      return { over: true, type: 'team', winner: Team.SYSTEM };
    }
  }

  return { over: false };
}

export function checkAnyWin(state: GameStateModel, context: { justVotedOut?: string } = {}): WinResult {
  const solo = checkSoloWin(state, context);
  if (solo.over) return solo;
  return checkTeamWin(state);
}

export function tickRansomwareCooldowns(state: GameStateModel) {
  for (const p of state.players) {
    const meta = getMeta(p);
    if (meta.ransomwareCooldown && meta.ransomwareCooldown > 0) {
      meta.ransomwareCooldown -= 1;
    }
  }
}

export function applyZeroDayAssume(state: GameStateModel, actorId: string, deadPlayerId: string) {
  const actor = state.getPlayer(actorId);
  const dead = state.getPlayer(deadPlayerId);
  if (!actor || !dead || !dead.role) return;

  actor.role = dead.role;
  actor.team = dead.team ?? ROLE_CATALOG[dead.role].team;
  const meta = getMeta(actor);
  meta.assumedFromPlayerId = deadPlayerId;
  state.log(`Zero-Day ${actorId} assumed role of ${deadPlayerId}`);
}
