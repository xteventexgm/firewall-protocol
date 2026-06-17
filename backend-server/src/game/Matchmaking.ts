import { Player } from '../models/PlayerProfile';
import { ROLE_CATALOG, RoleName, Team } from '../types/roles.types';
import { RoleId } from '../types';

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

/**
 * Assign roles to players.
 * - Enforce player count between 5 and 15.
 * - Aim for 25% hackers; when exact proportion isn't an integer, rounds to nearest and logs.
 * - Returns mapping of playerId -> RoleId and mutates `player.role` and `player.team`.
 */
export function assignRoles(players: Player[], rngFn?: RNG) {
  const rng = rngFn || defaultRng;
  const n = players.length;
  if (n < 5 || n > 15) throw new Error('Matchmaking supports 5 to 15 players');

  const idealHackers = n * 0.25;
  let hackerCount = Math.max(1, Math.round(idealHackers));
  if (Math.abs(hackerCount - idealHackers) > 0.0001 && Number.isFinite(idealHackers)) {
    // best-effort: round to nearest to keep close to 25%
    // caller may enforce strict multiples of 4 if 'exact' integer proportion is required
    // (we choose rounding to maintain playability for 5-15 players)
    // no-op (we already rounded)
  }

  // prepare role pools
  const blackHatRoles = rolesByTeam(Team.BLACK_HAT);
  const systemRoles = rolesByTeam(Team.SYSTEM);
  const chaoticRoles = rolesByTeam(Team.CHAOTIC);

  // shuffle players deterministically
  const shuffled = shuffle(players, rng);

  const assignments: Record<string, RoleId> = {};

  // assign hackers
  for (let i = 0; i < hackerCount; i++) {
    const p = shuffled[i];
    // pick a random black hat role (allow repeats if players > roles)
    const role = blackHatRoles[Math.floor(rng() * blackHatRoles.length)];
    p.role = role;
    p.team = Team.BLACK_HAT;
    assignments[p.id] = role;
  }

  // assign remaining players roles from system + chaotic
  const remaining = shuffled.slice(hackerCount);
  // combine pools with a bias towards system roles (2:1)
  const weightedPool = [...systemRoles, ...systemRoles, ...chaoticRoles];
  for (const p of remaining) {
    const role = weightedPool[Math.floor(rng() * weightedPool.length)];
    p.role = role;
    p.team = ROLE_CATALOG[role].team;
    assignments[p.id] = role;
  }

  return {
    hackerCount,
    assignments,
  };
}

export default assignRoles;
