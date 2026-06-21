/**
 * Ejecutar: npx ts-node src/utils/socketErrors.test.ts
 */
import { formatSocketError, isValidRoomCode, normalizeRoomCode } from './socketErrors';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

assert(
  formatSocketError('Sala no encontrada', 'room_not_found') ===
    'Sala no encontrada (room_not_found)',
  'formatSocketError',
);
assert(isValidRoomCode('fire-ab12'), 'isValidRoomCode lowercase');
assert(isValidRoomCode('FIRE-9FME'), 'isValidRoomCode valid');
assert(!isValidRoomCode('ABC-1234'), 'isValidRoomCode invalid prefix');
assert(!isValidRoomCode('FIRE-12'), 'isValidRoomCode short suffix');
assert(normalizeRoomCode(' fire-ab12 ') === 'FIRE-AB12', 'normalizeRoomCode');

console.log('socketErrors.test.ts — OK');
