/**
 * Estadísticas de partida para pantalla post-game y engagement.
 */
import { GameStateModel } from '../models/GameState';
import { GameStats, GameStatsEntry } from '../types/events.types';
import { Team } from '../types/roles.types';

export function initGameStats(): GameStats {
  return {
    scansPerformed: 0,
    killsPrevented: 0,
    infectionsApplied: 0,
    votesCast: 0,
    honeypotDrags: 0,
    playerActions: {},
    mvpPlayerId: null,
    mvpReason: null,
  };
}

export function recordNightStats(
  stats: GameStats,
  resolution: {
    prevented: unknown[];
    infections: string[];
    honeypotDrags: unknown[];
    kills: string[];
  },
): void {
  stats.killsPrevented += resolution.prevented.length;
  stats.infectionsApplied += resolution.infections.length;
  stats.honeypotDrags += resolution.honeypotDrags.length;
}

export function recordVote(stats: GameStats): void {
  stats.votesCast += 1;
}

export function recordPlayerAction(stats: GameStats, playerId: string): void {
  stats.playerActions[playerId] = (stats.playerActions[playerId] ?? 0) + 1;
}

export function recordScan(stats: GameStats): void {
  stats.scansPerformed += 1;
}

/** Calcula MVP heurístico al fin de partida. */
export function computeMvp(state: GameStateModel): GameStats {
  const stats = state.gameStats ?? initGameStats();
  let bestId: string | null = null;
  let bestScore = 0;
  let reason = '';

  for (const [pid, count] of Object.entries(stats.playerActions)) {
    const p = state.getPlayer(pid);
    if (!p) continue;
    let score = count * 2;
    if (p.team === Team.SYSTEM) {
      score += stats.scansPerformed > 0 ? 2 : 0;
      if (stats.killsPrevented > 0) score += 4;
    }
    if (p.team === Team.BLACK_HAT && count >= 2) score += 3;
    if (score > bestScore) {
      bestScore = score;
      bestId = pid;
      reason =
        p.team === Team.SYSTEM
          ? 'Mayor impacto defensivo y actividad estratégica'
          : 'Mayor actividad ofensiva nocturna';
    }
  }

  if (!bestId && stats.killsPrevented > 0) {
    reason = 'Defensa crítica del sistema';
  }

  stats.mvpPlayerId = bestId;
  stats.mvpReason = bestId ? reason : null;
  return stats;
}

export function buildStatsEntries(state: GameStateModel): GameStatsEntry[] {
  const stats = state.gameStats ?? initGameStats();
  const entries: GameStatsEntry[] = [];

  entries.push({ label: 'Escaneos SOC', value: String(stats.scansPerformed) });
  entries.push({ label: 'Ataques bloqueados', value: String(stats.killsPrevented) });
  entries.push({ label: 'Infecciones', value: String(stats.infectionsApplied) });
  entries.push({ label: 'Votos registrados', value: String(stats.votesCast) });
  entries.push({ label: 'Trampas Honeypot', value: String(stats.honeypotDrags) });
  entries.push({ label: 'Días jugados', value: String(state.dayNumber) });
  entries.push({ label: 'Noches resueltas', value: String(state.nightNumber) });

  if (stats.mvpPlayerId) {
    const mvp = state.getPlayer(stats.mvpPlayerId);
    entries.push({
      label: 'MVP',
      value: mvp?.name ?? stats.mvpPlayerId,
      detail: stats.mvpReason ?? undefined,
    });
  }

  return entries;
}
