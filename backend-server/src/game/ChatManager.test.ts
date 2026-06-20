/**
 * Ejecutar: npx ts-node src/game/ChatManager.test.ts
 */
import { GameStateModel } from '../models/GameState';
import { Player } from '../models/PlayerProfile';
import { GamePhase } from '../types';
import { submitChatMessage } from './ChatManager';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`OK: ${message}`);
}

const state = new GameStateModel('FIRE-CHAT');
state.phase = GamePhase.DIA;
const player = new Player('p1', 'Tester', 's1');
state.players.push(player);

// Mensaje ok
{
  const r = submitChatMessage(state, 'p1', 'Hola red', 'public');
  assert(r.ok === true, 'mensaje aceptado');
}

// Vacío rechazado
{
  const r = submitChatMessage(state, 'p1', '   ', 'public');
  assert(!r.ok, 'mensaje vacío rechazado');
  if (!r.ok) assert(r.reason.includes('empty_message'), 'código empty_message');
}

// Rate limit con cooldown
{
  const last = Date.now();
  const r = submitChatMessage(state, 'p1', 'Otro', 'public', last);
  assert(!r.ok, 'rate_limit activo');
  if (!r.ok) {
    assert(r.reason.includes('rate_limit'), 'código rate_limit');
    assert(/\d+s/.test(r.reason), 'rate_limit indica segundos de espera');
  }
}

// Burst por minuto
{
  const burstState = new GameStateModel('FIRE-BRST');
  burstState.phase = GamePhase.DIA;
  burstState.players.push(new Player('p2', 'Spammer', 's2'));
  const now = Date.now();
  for (let i = 0; i < 10; i++) {
    burstState.chatMessages.push({
      id: `m${i}`,
      playerId: 'p2',
      playerName: 'Spammer',
      text: `msg${i}`,
      channel: 'public',
      timestamp: now - 1000,
      phase: GamePhase.DIA,
    });
  }
  const r = submitChatMessage(burstState, 'p2', 'uno más', 'public', now - 5000);
  assert(!r.ok, 'rate_burst tras 10 msgs/min');
  if (!r.ok) assert(r.reason.includes('rate_burst'), 'código rate_burst');
}

// Fase NOCHE: público deshabilitado, hacker habilitado
{
  const night = new GameStateModel('FIRE-NGT');
  night.phase = GamePhase.NOCHE;
  night.players.push(player);
  const r = submitChatMessage(night, 'p1', 'noche', 'public');
  assert(!r.ok, 'chat público deshabilitado en NOCHE');
}

// Muertos no pueden chat público
{
  const deadState = new GameStateModel('FIRE-DED');
  deadState.phase = GamePhase.DIA;
  const dead = new Player('pd', 'Ghost', 's9');
  dead.isAlive = false;
  deadState.players.push(dead);
  const r = submitChatMessage(deadState, 'pd', 'hola vivos', 'public');
  assert(!r.ok, 'muerto no puede chat público');
  if (!r.ok) assert(r.reason.includes('channel_denied'), 'código channel_denied');
}

// Canal hacker en NOCHE
{
  const hackNight = new GameStateModel('FIRE-HCK');
  hackNight.phase = GamePhase.NOCHE;
  const hacker = new Player('h1', 'Hacker', 's10');
  hacker.team = 'black_hat';
  hackNight.players.push(hacker);
  const r = submitChatMessage(hackNight, 'h1', 'coordinemos', 'hacker');
  assert(r.ok === true, 'hacker puede chat en NOCHE');
}

// Muertos pueden chat en NOCHE (canal dead)
{
  const deadNight = new GameStateModel('FIRE-DNN');
  deadNight.phase = GamePhase.NOCHE;
  const dead = new Player('pd2', 'Ghost2', 's11');
  dead.isAlive = false;
  deadNight.players.push(dead);
  const r = submitChatMessage(deadNight, 'pd2', 'espectando', 'dead');
  assert(r.ok === true, 'muerto puede chat dead en NOCHE');
}

console.log('\nChatManager.test.ts — todos los tests pasaron');
