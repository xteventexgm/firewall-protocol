/**
 * Ejecutar: npx ts-node src/game/roomJoin.test.ts
 *
 * Pruebas de lógica de join/reconnect (equivalente a roomHandler sin socket.io).
 */
import RoomManager, { RoomClosedError } from './RoomManager';
import Room, { RoomJoinDeniedError } from './Room';
import { Player } from '../models/PlayerProfile';
import { GamePhase } from '../types';
import { isValidRoomCode, normalizeRoomCode } from '../utils/socketErrors';
import database from '../config/database';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`OK: ${message}`);
}

const TEST_ROOM = 'FIRE-TST1';

function cleanup() {
  RoomManager.deleteRoom(TEST_ROOM);
  database.delete(TEST_ROOM);
}

try {
  cleanup();

  // Códigos de sala
  assert(isValidRoomCode('fire-ab12'), 'código válido normalizado');
  assert(!isValidRoomCode('BAD'), 'código inválido rechazado');
  assert(normalizeRoomCode(' fire-tst1 ') === 'FIRE-TST1', 'normalizeRoomCode');

  // Crear sala y unir jugador
  const room = RoomManager.createRoom(TEST_ROOM, { maxPlayers: 5 });
  assert(room.state.phase === GamePhase.LOBBY, 'fase LOBBY al crear');
  room.addPlayer(new Player('p1', 'Alice', 'sock1'));
  assert(room.state.players.length === 1, 'jugador añadido');

  // Reconnect mismo playerId
  assert(room.reconnectPlayer('p1', 'sock2', 'Alice2') !== false, 'reconnect ok');
  assert(room.state.getPlayer('p1')?.socketId === 'sock2', 'socket actualizado');
  assert(room.state.getPlayer('p1')?.name === 'Alice2', 'nombre actualizado en reconnect');

  // Sala llena
  room.addPlayer(new Player('p2', 'Bob', 'sock3'));
  room.addPlayer(new Player('p3', 'Carol', 'sock4'));
  room.addPlayer(new Player('p4', 'Dave', 'sock5'));
  room.addPlayer(new Player('p5', 'Eve', 'sock6'));
  assert(room.state.players.length === 5, 'sala con 5 jugadores');
  let fullThrown = false;
  try {
    room.addPlayer(new Player('p6', 'Frank', 'sock7'));
  } catch (e: any) {
    fullThrown = e?.message?.includes('full') ?? false;
  }
  assert(fullThrown, 'sala llena rechaza nuevo jugador');

  // Partida iniciada — no nuevos joins (sala aparte, no llena)
  const startedRoom = new Room('FIRE-TST3', { maxPlayers: 5, restore: false });
  startedRoom.addPlayer(new Player('s1', 'Starter', 'sock1'));
  (startedRoom as any).sm.restorePhase(GamePhase.DIA);
  startedRoom.state.phase = GamePhase.DIA;
  let deniedThrown = false;
  try {
    startedRoom.addPlayer(new Player('s2', 'Late', 'sock2'));
  } catch (e) {
    deniedThrown = e instanceof RoomJoinDeniedError;
  }
  assert(deniedThrown, 'game_started rechaza join (RoomJoinDeniedError)');

  // Sala FIN — RoomClosedError al restaurar
  (room as any).sm.restorePhase(GamePhase.FIN);
  room.state.phase = GamePhase.FIN;
  let closedThrown = false;
  try {
    RoomManager.getOrRestoreRoom(TEST_ROOM);
  } catch (e) {
    closedThrown = e instanceof RoomClosedError;
  }
  assert(closedThrown, 'game_ended lanza RoomClosedError');

  // Sala inexistente
  const missing = RoomManager.getOrRestoreRoom('FIRE-ZZZZ');
  assert(missing === null, 'sala inexistente devuelve null');

  // Room aislada sin manager
  const solo = new Room('FIRE-TST2', { maxPlayers: 5, restore: false });
  solo.addPlayer(new Player('x1', 'Solo', 's1'));
  assert(solo.state.getPlayer('x1')?.isConnected === true, 'jugador nuevo conectado');

  console.log('\nroomJoin.test.ts — todos los tests pasaron');
} finally {
  cleanup();
  RoomManager.deleteRoom('FIRE-TST2');
  database.delete('FIRE-TST3');
}
