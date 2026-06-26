/**
 * Genera y persiste un registro legible (.log) al archivar una partida terminada.
 * Complementa el JSON en `data/finishgame/` — no sustituye el replay JSON.
 */
import * as fs from 'fs';
import * as path from 'path';
import { FINISHED_GAMES_DIR } from '../utils/constants';
import { logger } from '../utils/logger';
import { PublicLogEntry, GameStats } from '../types/events.types';

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function winnerLine(state: Record<string, unknown>): string {
  const solo = state.soloWinner as { role?: string; playerId?: string; reason?: string } | null;
  if (solo?.role) {
    return `SOLITARIO — ${solo.role}${solo.reason ? ` (${solo.reason})` : ''}`;
  }
  const winner = state.winner as string | null;
  if (winner === 'system') return 'SYSTEM VICTORIOSO';
  if (winner === 'black_hat') return 'BLACK HAT VICTORIOSO';
  return winner ?? 'Sin resultado';
}

function formatPublicLog(entry: PublicLogEntry): string {
  const tag = entry.severity.toUpperCase().padEnd(8);
  const day = entry.dayNumber != null ? ` D${entry.dayNumber}` : '';
  const night = entry.nightNumber != null ? ` N${entry.nightNumber}` : '';
  return `[${tag}]${day}${night} ${entry.message}`;
}

/** Construye el texto del registro de sesión desde el snapshot persistido. */
export function buildSessionLogText(state: Record<string, unknown>): string {
  const roomId = String(state.roomId ?? 'UNKNOWN');
  const players = (state.players ?? []) as Array<{
    id: string;
    name: string;
    role?: string;
    team?: string;
    isAlive?: boolean;
    isBot?: boolean;
  }>;
  const botCount = players.filter((p) => p.isBot).length;
  const lines: string[] = [];

  lines.push('='.repeat(80));
  lines.push(' FIREWALL PROTOCOL — REGISTRO DE SESIÓN');
  lines.push('='.repeat(80));
  lines.push(` Sala:          ${roomId}`);
  lines.push(` Archivado:     ${state.archivedAt ?? new Date().toISOString()}`);
  lines.push(` Fase final:    ${state.phase ?? 'FIN'}`);
  lines.push(` Resultado:     ${winnerLine(state)}`);
  lines.push(
    ` Jugadores:     ${players.length}/${state.maxPlayers ?? '?'} (${botCount} bot${botCount === 1 ? '' : 's'} QA)`,
  );
  lines.push(` Días:          ${state.dayNumber ?? 0}  |  Noches: ${state.nightNumber ?? 0}`);
  lines.push('');

  lines.push('--- JUGADORES (revelación final) ---');
  for (const p of players) {
    const status = p.isAlive === false ? 'MUERTO' : 'VIVO';
    const bot = p.isBot ? ' [BOT]' : '';
    lines.push(
      ` ${p.name.padEnd(14)} ${(p.role ?? '—').padEnd(18)} ${(p.team ?? '—').padEnd(12)} ${status}${bot}`,
    );
  }
  lines.push('');

  const publicLogs = (state.publicLogs ?? []) as PublicLogEntry[];
  lines.push('--- CRÓNICA SIEM (feed público / TV) ---');
  if (publicLogs.length) {
    for (const entry of publicLogs) {
      lines.push(formatPublicLog(entry));
    }
  } else {
    lines.push(' (sin entradas públicas)');
  }
  lines.push('');

  const serverLogs = (state.logs ?? []) as string[];
  lines.push('--- REGISTRO TÉCNICO (servidor) ---');
  if (serverLogs.length) {
    for (const entry of serverLogs) {
      lines.push(` ${entry}`);
    }
  } else {
    lines.push(' (sin entradas internas)');
  }
  lines.push('');

  const stats = state.gameStats as GameStats | undefined;
  if (stats) {
    lines.push('--- ESTADÍSTICAS ---');
    lines.push(` Escaneos SOC: ${stats.scansPerformed}`);
    lines.push(` Ataques bloqueados: ${stats.killsPrevented}`);
    lines.push(` Infecciones: ${stats.infectionsApplied}`);
    lines.push(` Votos registrados: ${stats.votesCast}`);
    lines.push(` Trampas Honeypot: ${stats.honeypotDrags}`);
    lines.push(` Días jugados: ${state.dayNumber ?? 0}`);
    lines.push(` Noches resueltas: ${state.nightNumber ?? 0}`);
    if (stats.mvpPlayerId) {
      const mvp = players.find((p) => p.id === stats.mvpPlayerId);
      lines.push(` MVP: ${mvp?.name ?? stats.mvpPlayerId}${stats.mvpReason ? ` — ${stats.mvpReason}` : ''}`);
    }
    lines.push('');
  }

  const chat = (state.chatMessages ?? []) as Array<{
    playerName: string;
    text: string;
    channel: string;
    phase: string;
  }>;
  const publicChat = chat.filter((m) => m.channel === 'public');
  if (publicChat.length) {
    lines.push('--- CHAT PÚBLICO ---');
    for (const m of publicChat.slice(-50)) {
      lines.push(` [${m.phase}] ${m.playerName}: ${m.text}`);
    }
    lines.push('');
  }

  lines.push('='.repeat(80));
  lines.push(` Fin del registro — ${roomId}.log`);
  lines.push('='.repeat(80));

  return lines.join('\n');
}

/** Escribe `{roomId}.log` en `data/finishgame/`. */
export function writeSessionLogFile(roomId: string, state: Record<string, unknown>): boolean {
  try {
    ensureDir(FINISHED_GAMES_DIR);
    const file = path.join(FINISHED_GAMES_DIR, `${roomId}.log`);
    const text = buildSessionLogText(state);
    fs.writeFileSync(file, text, { encoding: 'utf8' });
    logger.info('[session-log] wrote', { roomId, file, bytes: text.length });
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[session-log] write failed', { roomId, error: msg });
    return false;
  }
}

/** Lee el .log de una partida archivada, o null si no existe. */
export function readSessionLogFile(roomId: string): string | null {
  try {
    const file = path.join(FINISHED_GAMES_DIR, `${roomId}.log`);
    if (!fs.existsSync(file)) return null;
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** Carga JSON de partida terminada desde finishgame/. */
export function loadFinishedGameState(roomId: string): Record<string, unknown> | null {
  try {
    const file = path.join(FINISHED_GAMES_DIR, `${roomId}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}
