import * as assert from 'assert';
import { prepareGameDocument, statusFromGame } from './MongoDBAdapter';

const persisted = prepareGameDocument('FIRE-TEST', {
  phase: 'NOCHE',
  players: [{ id: 'p1', name: 'Ada', socketId: 'runtime-only', isConnected: true }],
});
assert.strictEqual(persisted.roomId, 'FIRE-TEST');
assert.strictEqual(persisted.players[0].socketId, undefined);

assert.deepStrictEqual(statusFromGame(null), {
  exists: false,
  phase: null,
  playerCount: 0,
  connectedCount: 0,
  canJoin: false,
  canReconnect: false,
});

const status = statusFromGame({
  phase: 'NOCHE',
  players: [{ id: 'p1', isConnected: false }, { id: 'p2', isConnected: true }],
}, 'p1');
assert.strictEqual(status.exists, true);
assert.strictEqual(status.playerCount, 2);
assert.strictEqual(status.connectedCount, 1);
assert.strictEqual(status.canReconnect, true);
assert.strictEqual(status.canJoin, false);

console.log('MongoDB adapter unit tests passed');
