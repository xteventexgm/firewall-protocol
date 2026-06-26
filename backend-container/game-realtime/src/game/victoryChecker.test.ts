/**
 * Ejecutar: npx ts-node src/game/victoryChecker.test.ts
 */
import { Player } from '../models/PlayerProfile';
import { GameStateModel } from '../models/GameState';
import { RoleName, Team } from '../types/roles.types';
import { checkAnyWin, countFactionAlive } from './VictoryChecker';
import { stalemateDayLimit } from './balance';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`OK: ${message}`);
}

function makeState(
  alive: Array<{ id: string; team: Team; role?: RoleName }>,
  dayNumber = 1,
  initialPlayerCount = 10,
): GameStateModel {
  const state = new GameStateModel('FIRE-WIN');
  state.initialPlayerCount = initialPlayerCount;
  state.dayNumber = dayNumber;
  for (const spec of alive) {
    const p = new Player(spec.id, spec.id);
    p.team = spec.team;
    p.role = spec.role ?? defaultRoleForTeam(spec.team);
    p.isAlive = true;
    state.players.push(p);
  }
  return state;
}

function defaultRoleForTeam(team: Team): RoleName {
  if (team === Team.BLACK_HAT) return RoleName.ROOTKIT;
  if (team === Team.CHAOTIC) return RoleName.TROLL;
  return RoleName.SYSADMIN;
}

// FIRE-SWEW scenario: 5H, 4S, 2C — must NOT end for Black Hat
{
  const state = makeState([
    ...Array.from({ length: 5 }, (_, i) => ({ id: `h${i}`, team: Team.BLACK_HAT })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: `s${i}`, team: Team.SYSTEM })),
    ...Array.from({ length: 2 }, (_, i) => ({ id: `c${i}`, team: Team.CHAOTIC })),
  ]);
  const result = checkAnyWin(state);
  assert(!result.over, '5H 4S 2C — partida continúa (system aún vivo)');
}

// System wins only when hackers AND chaotics eliminated
{
  const state = makeState([
    { id: 's1', team: Team.SYSTEM },
    { id: 's2', team: Team.SYSTEM },
    { id: 'c1', team: Team.CHAOTIC },
  ]);
  const result = checkAnyWin(state);
  assert(!result.over, '0H 2S 1C — system no gana hasta eliminar caóticos');
}

{
  const state = makeState([
    { id: 's1', team: Team.SYSTEM },
    { id: 's2', team: Team.SYSTEM },
  ]);
  const result = checkAnyWin(state);
  assert(result.over && result.type === 'team' && result.winner === Team.SYSTEM, '0H 2S 0C — system gana');
}

// Black Hat needs S=0 and H>C if chaotics remain
{
  const state = makeState([
    { id: 'h1', team: Team.BLACK_HAT },
    { id: 'h2', team: Team.BLACK_HAT },
    { id: 'c1', team: Team.CHAOTIC },
    { id: 'c2', team: Team.CHAOTIC },
    { id: 'c3', team: Team.CHAOTIC },
  ]);
  const result = checkAnyWin(state);
  assert(!result.over, '2H 0S 3C — hackers no dominan caóticos');
}

{
  const state = makeState([
    { id: 'h1', team: Team.BLACK_HAT },
    { id: 'h2', team: Team.BLACK_HAT },
    { id: 'h3', team: Team.BLACK_HAT },
    { id: 'c1', team: Team.CHAOTIC },
  ]);
  const result = checkAnyWin(state);
  assert(result.over && result.type === 'team' && result.winner === Team.BLACK_HAT, '3H 0S 1C — black hat gana');
}

// Old rule would have ended 5H vs 4S — new rule continues
{
  const counts = countFactionAlive(
    makeState([
      { id: 'h', team: Team.BLACK_HAT },
      { id: 's', team: Team.SYSTEM },
    ]),
  );
  assert(counts.hackers === 1 && counts.system === 1, 'countFactionAlive');
}

// Stalemate: protracted conflict favors containment when S > H
{
  const limit = stalemateDayLimit(10);
  const state = makeState(
    [
      { id: 'h1', team: Team.BLACK_HAT },
      { id: 'h2', team: Team.BLACK_HAT },
      { id: 's1', team: Team.SYSTEM },
      { id: 's2', team: Team.SYSTEM },
      { id: 's3', team: Team.SYSTEM },
      { id: 'c1', team: Team.CHAOTIC },
    ],
    limit,
    10,
  );
  const result = checkAnyWin(state);
  assert(result.over && result.type === 'team' && result.winner === Team.SYSTEM, 'stalemate 2H 3S 1C → system');
}

console.log('\nAll victory checker tests passed.');
