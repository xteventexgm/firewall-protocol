/**
 * Ejecutar: npx ts-node src/game/voteResolution.test.ts
 */
import { computeVoteResolution } from './voteResolution';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`OK: ${message}`);
}

const alive = new Set(['a', 'b', 'c', 'd']);
const roomId = 'FIRE-TEST';

// Empate perfecto 2 vs 2 — nadie eliminado
{
  const { resolution, events } = computeVoteResolution(
    roomId,
    { a: ['c', 'd'], b: ['a', 'b'] },
    alive,
  );
  assert(resolution.tied === true, 'tie flag');
  assert(resolution.eliminated === null, 'no elimination on tie');
  assert(resolution.reason === 'tie', 'reason tie');
  assert(events.voteTied?.reason === 'tie', 'voteTied event');
  assert(events.eliminatedPlayerId === undefined, 'no eliminated event');
}

// Mayoría clara — un eliminado
{
  const { resolution } = computeVoteResolution(
    roomId,
    { a: ['b', 'c', 'd'], b: ['a'] },
    alive,
  );
  assert(resolution.tied === false, 'not tied');
  assert(resolution.eliminated === 'a', 'a eliminated');
}

// Sin votos de eliminación
{
  const { resolution } = computeVoteResolution(roomId, { skip: ['a', 'b'] }, alive);
  assert(resolution.tied === true, 'no votes is tied');
  assert(resolution.reason === 'no_votes', 'no_votes reason');
}

// Empate a 3 bandas
{
  const { resolution } = computeVoteResolution(
    roomId,
    { a: ['b'], b: ['c'], c: ['d'] },
    alive,
  );
  assert(resolution.tied === true, '3-way tie');
  assert(resolution.eliminated === null, '3-way no kill');
  assert(resolution.reason === 'tie', '3-way reason tie');
}

console.log('\nAll vote resolution tests passed.');
