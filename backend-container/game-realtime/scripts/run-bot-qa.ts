/**
 * CLI headless: partida QA solo con bots hasta FIN.
 *
 * Uso:
 *   npm run qa:bot-match
 *   npm run qa:bot-match -- FIRE-QA01
 *   npm run qa:bot-match -- FIRE-QA01 12
 *
 * Variables opcionales:
 *   QA_MAX_PLAYERS=12     — capacidad de sala (5–16, default 5)
 *   QA_TIMEOUT_MS=120000  — aborta si no termina a tiempo
 *   QA_MAX_DAYS=40        — aborta si supera días de juego
 */
import { randomBytes } from 'crypto';
import Room from '../src/game/Room';
import { attachBotController, runBotQaMatch } from '../src/game/BotController';
import { devBotsEnabled } from '../src/config/env';
import { GamePhase } from '../src/types';
import { MIN_PLAYERS, MAX_PLAYERS, FINISHED_GAMES_DIR } from '../src/utils/constants';
import * as path from 'path';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function randomRoomCode(): string {
  const suffix = randomBytes(2).toString('hex').toUpperCase().slice(0, 4);
  return `FIRE-${suffix}`;
}

async function main(): Promise<void> {
  if (!devBotsEnabled()) {
    console.error('[qa:bot-match] DEV_BOTS=false — abortando.');
    process.exit(1);
  }

  const roomId = (process.argv[2] || randomRoomCode()).toUpperCase();
  const maxPlayersArg = Number(process.argv[3] || process.env.QA_MAX_PLAYERS || 5);
  const maxPlayers = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, maxPlayersArg));
  const timeoutMs = Number(process.env.QA_TIMEOUT_MS || Math.max(180_000, maxPlayers * 25_000));
  const maxDays = Number(process.env.QA_MAX_DAYS || 40);

  const room = new Room(roomId, { maxPlayers, restore: false });
  attachBotController(room);

  room.on('phaseChanged', ({ from, to }: { from: GamePhase; to: GamePhase }) => {
    console.log(
      `[qa:bot-match] ${roomId}  ${from} → ${to}  (D${room.state.dayNumber} N${room.state.nightNumber}, ${room.state.players.length} jugadores)`,
    );
  });

  room.on('gameOver', (payload: { winner: string | null; soloWinner: unknown }) => {
    console.log('[qa:bot-match] gameOver', JSON.stringify(payload));
  });

  console.log(`[qa:bot-match] Iniciando sala ${roomId} (capacidad ${maxPlayers})…`);
  runBotQaMatch(room);

  const started = Date.now();
  while (room.state.phase !== GamePhase.FIN) {
    if (Date.now() - started > timeoutMs) {
      console.error(`[qa:bot-match] Timeout (${timeoutMs}ms) en fase ${room.state.phase}`);
      process.exit(2);
    }
    if (room.state.dayNumber > maxDays) {
      console.error(`[qa:bot-match] Límite de días (${maxDays}) superado`);
      process.exit(3);
    }
    await sleep(250);
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[qa:bot-match] FIN en ${elapsed}s`);
  console.log(`  Ganador bando: ${room.state.winner ?? '—'}`);
  console.log(`  Ganador solitario: ${room.state.soloWinner ? JSON.stringify(room.state.soloWinner) : '—'}`);
  console.log(`  Días: ${room.state.dayNumber}  Noches: ${room.state.nightNumber}`);
  console.log(`  Registro: ${path.join(FINISHED_GAMES_DIR, `${roomId}.log`)}`);
  console.log(`  JSON archivado: ${path.join(FINISHED_GAMES_DIR, `${roomId}.json`)}`);
  console.log(`  Logs públicos (últimos 5):`);
  for (const log of room.state.publicLogs.slice(-5)) {
    console.log(`    [${log.severity}] ${log.message}`);
  }

  room.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error('[qa:bot-match] Error fatal:', err);
  process.exit(1);
});
