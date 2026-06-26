/**
 * Condiciones de victoria y efectos post-noche (cooldowns).
 *
 * Orden en `checkAnyWin`: solitarias (Troll, Gusano, Minero) → bando → desempate por días.
 *
 * Tres bandos en conteo de victoria de equipo:
 * - System: 0 hackers Y 0 caóticos vivos (≥1 system).
 * - Black Hat: 0 system vivos, ≥1 hacker, y si quedan caóticos entonces hackers > caóticos.
 * - Caóticos cuentan como tercer equipo; no se ignoran en el fin de partida por bando.
 *
 * Zero-Day hereda victoria de bando al asumir rol (rol y team cambian).
 */
import { SoloWinner } from '../types';
import { RoleName, Team, ROLE_CATALOG } from '../types/roles.types';
import { GameStateModel } from '../models/GameState';
import { getMeta, initRoleMetadata } from './playerMetadata';
import { stalemateDayLimit } from './balance';

/** Resultado de comprobar fin de partida. */
export type WinResult =
  | { over: true; type: 'team'; winner: Team }
  | { over: true; type: 'solo'; solo: SoloWinner }
  | { over: false };

export interface FactionCounts {
  hackers: number;
  system: number;
  chaotics: number;
}

/** Conteo de vivos por bando (team, no rol asumido por Zero-Day ya refleja team actualizado). */
export function countFactionAlive(state: GameStateModel): FactionCounts {
  const alive = state.getAlivePlayers();
  return {
    hackers: alive.filter(p => p.team === Team.BLACK_HAT).length,
    system: alive.filter(p => p.team === Team.SYSTEM).length,
    chaotics: alive.filter(p => p.team === Team.CHAOTIC).length,
  };
}

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

/** Si solo quedan caóticos tras el límite de días, gana el rol con victoria solitaria más viable. */
function pickChaoticStalemateWinner(alive: ReturnType<GameStateModel['getAlivePlayers']>): WinResult {
  const chaotics = alive.filter(p => p.team === Team.CHAOTIC);
  if (chaotics.length === 0) return { over: false };

  const priority: RoleName[] = [
    RoleName.WORM,
    RoleName.CRYPTO_MINER,
    RoleName.TROLL,
    RoleName.SHADOW,
    RoleName.LOGIC_BOMB,
    RoleName.DATA_LEAKER,
    RoleName.DNS_POISONER,
    RoleName.RANSOM_NOTE,
    RoleName.DROPPER,
    RoleName.SABOTEUR,
    RoleName.WHITE_NOISE,
    RoleName.MIRAGE,
    RoleName.CHAOS_ROUTER,
    RoleName.ZERO_DAY,
  ];
  for (const role of priority) {
    const match = chaotics.find(p => p.role === role);
    if (match) {
      return {
        over: true,
        type: 'solo',
        solo: { playerId: match.id, role, reason: 'chaotic_stalemate_break' },
      };
    }
  }
  return { over: false };
}

function checkTeamWin(state: GameStateModel): WinResult {
  const { hackers: H, system: S, chaotics: C } = countFactionAlive(state);

  // System: red limpia — sin hackers ni caóticos amenazando
  if (H === 0 && C === 0 && S >= 1) {
    return { over: true, type: 'team', winner: Team.SYSTEM };
  }

  // Black Hat: infraestructura caída; domina caóticos si aún quedan
  if (S === 0 && H >= 1 && (C === 0 || H > C)) {
    return { over: true, type: 'team', winner: Team.BLACK_HAT };
  }

  if (H === 0 && S === 0 && C > 0) {
    const soloOnly = checkSoloWin(state);
    if (soloOnly.over) return soloOnly;
    return { over: false };
  }

  return { over: false };
}

/**
 * Desempate por límite de días: evita partidas eternas.
 * Prioriza las mismas condiciones de bando; si nadie las cumple, contención (System) o caótico.
 */
function checkStalemateBreak(state: GameStateModel): WinResult {
  const limit = stalemateDayLimit(state.initialPlayerCount || state.players.length);
  if (state.dayNumber < limit) return { over: false };

  const team = checkTeamWin(state);
  if (team.over) return team;

  const { hackers: H, system: S, chaotics: C } = countFactionAlive(state);
  const alive = state.getAlivePlayers();

  if (H === 0 && C === 0 && S > 0) {
    return { over: true, type: 'team', winner: Team.SYSTEM };
  }

  if (S === 0 && H >= 1 && (C === 0 || H > C)) {
    return { over: true, type: 'team', winner: Team.BLACK_HAT };
  }

  if (H === 0 && S > 0 && C > 0) {
    if (S > C) {
      return { over: true, type: 'team', winner: Team.SYSTEM };
    }
    const chaoticOnly = pickChaoticStalemateWinner(alive);
    if (chaoticOnly.over) return chaoticOnly;
  }

  if (H > 0 && S === 0 && C > 0) {
    if (H > C) {
      return { over: true, type: 'team', winner: Team.BLACK_HAT };
    }
    const chaoticOnly = pickChaoticStalemateWinner(alive);
    if (chaoticOnly.over) return chaoticOnly;
  }

  if (H > 0 && S > 0) {
    if (S > H && S >= C) {
      return { over: true, type: 'team', winner: Team.SYSTEM };
    }
    if (H > S && H > C) {
      return { over: true, type: 'team', winner: Team.BLACK_HAT };
    }
  }

  const chaoticOnly = pickChaoticStalemateWinner(alive);
  if (chaoticOnly.over) return chaoticOnly;

  return { over: true, type: 'team', winner: Team.SYSTEM };
}

/** Punto de entrada: solitario > bando > desempate por días. */
export function checkAnyWin(state: GameStateModel, context: { justVotedOut?: string } = {}): WinResult {
  const solo = checkSoloWin(state, context);
  if (solo.over) return solo;
  const team = checkTeamWin(state);
  if (team.over) return team;
  return checkStalemateBreak(state);
}

/** Decrementa ransomwareCooldown de todos los jugadores al iniciar cada NOCHE. */
export function tickRansomwareCooldowns(state: GameStateModel) {
  for (const p of state.players) {
    const meta = getMeta(p);
    if (meta.ransomwareCooldown && meta.ransomwareCooldown > 0) {
      meta.ransomwareCooldown -= 1;
    }
  }
}

/** Mutación de rol/equipo Zero-Day tras acción `zero_day_assume` (RuleEngine fase 3). */
export function applyZeroDayAssume(state: GameStateModel, actorId: string, deadPlayerId: string) {
  const actor = state.getPlayer(actorId);
  const dead = state.getPlayer(deadPlayerId);
  if (!actor || !dead || !dead.role) return;

  const assumedRole = dead.role;
  actor.role = assumedRole;
  actor.team = dead.team ?? ROLE_CATALOG[assumedRole].team;

  const tableSize = state.initialPlayerCount || state.players.length;
  const deadMeta = dead.metadata ? { ...dead.metadata } : initRoleMetadata(assumedRole, tableSize);
  actor.metadata = {
    ...deadMeta,
    actedThisNight: false,
    assumedFromPlayerId: deadPlayerId,
  };

  state.log(`Zero-Day ${actorId} assumed role of ${deadPlayerId} (${assumedRole})`);
}
