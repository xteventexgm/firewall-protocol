import { Player } from '../models/PlayerProfile';
import { ROLE_CATALOG, RoleName, Team } from '../types/roles.types';
import { RoleId } from '../types';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYERS_PER_CHAOTIC_ROLE,
} from '../utils/constants';
import { playersPerBlackHat } from './balance';

type RNG = () => number;

function defaultRng(): number {
  return Math.random();
}

function shuffle<T>(arr: T[], rng: RNG) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rolesByTeam(team: Team): RoleId[] {
  return Object.values(RoleName).filter(r => ROLE_CATALOG[r].team === team) as RoleId[];
}

/** Cuenta cuántos slots corresponden por proporción (floor), acotado al máximo disponible. */
function slotsByRatio(totalPlayers: number, playersPerSlot: number, maxSlots: number, minSlots = 0) {
  const raw = Math.floor(totalPlayers / playersPerSlot);
  return Math.max(minSlots, Math.min(raw, maxSlots));
}

function pickRole(pool: RoleId[], used: Set<RoleId>, rng: RNG): RoleId {
  const available = pool.filter(r => !used.has(r));
  const source = available.length > 0 ? available : pool;
  const role = source[Math.floor(rng() * source.length)];
  if (available.length > 0) used.add(role);
  return role;
}

function assignPool(
  players: Player[],
  pool: RoleId[],
  assignments: Record<string, RoleId>,
  rng: RNG,
) {
  const used = new Set<RoleId>();
  for (const p of players) {
    const role = pickRole(pool, used, rng);
    p.role = role;
    p.team = ROLE_CATALOG[role].team;
    assignments[p.id] = role;
  }
}

interface TeamBalance {
  hackerCount: number;
  chaoticCount: number;
  systemCount: number;
}

/** Calcula reparto de equipos según proporciones configurables en constants.ts */
function computeTeamBalance(playerCount: number): TeamBalance {
  const hackerCount = slotsByRatio(playerCount, playersPerBlackHat(playerCount), playerCount, 1);
  const chaoticCount = slotsByRatio(
    playerCount,
    PLAYERS_PER_CHAOTIC_ROLE,
    playerCount - hackerCount,
  );
  const systemCount = playerCount - hackerCount - chaoticCount;

  if (systemCount < 0) {
    throw new Error('Invalid team balance: not enough slots for system roles');
  }

  return { hackerCount, chaoticCount, systemCount };
}

/**
 * Assign roles to players.
 * - Enforce player count between MIN_PLAYERS and MAX_PLAYERS.
 * - Black Hat: 1 cada N jugadores (4 en mesas ≤8, 3 en 9+).
 * - Caóticos: 1 cada PLAYERS_PER_CHAOTIC_ROLE (por defecto 1:5); el resto es System.
 * - Dentro de cada pool se priorizan roles sin repetir hasta agotar el catálogo.
 * - Returns mapping of playerId -> RoleId and mutates `player.role` and `player.team`.
 */
export function assignRoles(players: Player[], rngFn?: RNG) {
  const rng = rngFn || defaultRng;
  const n = players.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) {
    throw new Error(`Matchmaking supports ${MIN_PLAYERS} to ${MAX_PLAYERS} players`);
  }

  const { hackerCount, chaoticCount, systemCount } = computeTeamBalance(n);
  const blackHatRoles = rolesByTeam(Team.BLACK_HAT);
  const systemRoles = rolesByTeam(Team.SYSTEM);
  const chaoticRoles = rolesByTeam(Team.CHAOTIC);

  const shuffled = shuffle(players, rng);
  const assignments: Record<string, RoleId> = {};

  const hackers = shuffled.slice(0, hackerCount);
  const chaotics = shuffled.slice(hackerCount, hackerCount + chaoticCount);
  const systems = shuffled.slice(hackerCount + chaoticCount);

  assignPool(hackers, blackHatRoles, assignments, rng);
  assignPool(chaotics, chaoticRoles, assignments, rng);
  assignPool(systems, systemRoles, assignments, rng);

  return {
    hackerCount,
    chaoticCount,
    systemCount,
    assignments,
  };
}

export default assignRoles;
