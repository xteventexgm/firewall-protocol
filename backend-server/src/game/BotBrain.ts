/**
 * Heurísticas ligeras para bots de QA (Fase 2).
 * Usa estado interno de la sala para cerrar partidas más rápido — solo entorno dev/QA.
 */
import Room from './Room';
import { Player } from '../models/PlayerProfile';
import { Team } from '../types/roles.types';
import { isInfected } from './infection';

function aliveOthers(room: Room, actorId: string): Player[] {
  return room.state.getAlivePlayers().filter((p) => p.id !== actorId);
}

function pickRandom<T>(arr: T[]): T | undefined {
  if (!arr.length) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Puntuación de sospecha por jugador vivo (infección, votos recibidos, caóticos). */
export function computeSuspicionScores(room: Room): Map<string, number> {
  const scores = new Map<string, number>();
  for (const p of room.state.getAlivePlayers()) {
    scores.set(p.id, 0);
  }

  for (const p of room.state.getAlivePlayers()) {
    if (isInfected(p)) {
      scores.set(p.id, (scores.get(p.id) ?? 0) + 5);
    }
    if (p.team === Team.CHAOTIC) {
      scores.set(p.id, (scores.get(p.id) ?? 0) + 1);
    }
  }

  for (const [targetId, voters] of Object.entries(room.state.votes)) {
    if (targetId === 'skip' || !scores.has(targetId)) continue;
    scores.set(targetId, (scores.get(targetId) ?? 0) + voters.length * 2);
  }

  for (const p of room.state.players) {
    if (p.isAlive || !p.role) continue;
    if (p.team === Team.BLACK_HAT) {
      for (const [targetId, voters] of Object.entries(room.state.votes)) {
        for (const voterId of voters) {
          if (voterId === p.id && scores.has(targetId)) {
            scores.set(targetId, Math.max(0, (scores.get(targetId) ?? 0) - 1));
          }
        }
      }
    }
  }

  return scores;
}

function pickHighestSuspicion(candidates: Player[], scores: Map<string, number>): Player | undefined {
  if (!candidates.length) return undefined;
  let best = candidates[0];
  let bestScore = scores.get(best.id) ?? 0;
  for (const p of candidates.slice(1)) {
    const s = scores.get(p.id) ?? 0;
    if (s > bestScore || (s === bestScore && Math.random() > 0.5)) {
      best = p;
      bestScore = s;
    }
  }
  return best;
}

/** Objetivo consensuado para hackers (eliminar system primero). */
export function pickHackerConsensusTarget(room: Room, actorId: string): string | null {
  const candidates = aliveOthers(room, actorId).filter((p) => p.team !== Team.BLACK_HAT);
  if (!candidates.length) return null;

  const system = candidates.filter((p) => p.team === Team.SYSTEM);
  const pool = system.length ? system : candidates;
  const scores = computeSuspicionScores(room);
  const target = pickHighestSuspicion(pool, scores) ?? pickRandom(pool);
  return target?.id ?? null;
}

/** Objetivo diurno de votación según bando del bot. */
export function pickVoteTarget(room: Room, voter: Player): string | null {
  const candidates = aliveOthers(room, voter.id);
  if (!candidates.length) return null;

  if (voter.team === Team.BLACK_HAT) {
    return pickHackerConsensusTarget(room, voter.id);
  }

  const scores = computeSuspicionScores(room);
  const nonAllies = candidates.filter((p) => p.team !== voter.team);
  const pool = nonAllies.length ? nonAllies : candidates;

  const voteCounts = new Map<string, number>();
  for (const [targetId, voters] of Object.entries(room.state.votes)) {
    if (targetId === 'skip') continue;
    voteCounts.set(targetId, voters.length);
  }
  const withVotes = pool
    .filter((p) => (voteCounts.get(p.id) ?? 0) > 0)
    .sort((a, b) => (voteCounts.get(b.id) ?? 0) - (voteCounts.get(a.id) ?? 0));
  if (withVotes.length) {
    return withVotes[0].id;
  }

  const infected = pool.filter((p) => isInfected(p));
  if (infected.length) {
    return pickHighestSuspicion(infected, scores)?.id ?? infected[0].id;
  }

  return pickHighestSuspicion(pool, scores)?.id ?? pickRandom(pool)?.id ?? null;
}

/** Objetivo nocturno genérico (scan, spy, kills ofensivos). */
export function pickOffensiveNightTarget(room: Room, actor: Player): string | null {
  if (actor.team === Team.BLACK_HAT) {
    return pickHackerConsensusTarget(room, actor.id);
  }

  const scores = computeSuspicionScores(room);
  const candidates = aliveOthers(room, actor.id).filter((p) => p.team !== actor.team);
  const pool = candidates.length ? candidates : aliveOthers(room, actor.id);
  return pickHighestSuspicion(pool, scores)?.id ?? pickRandom(pool)?.id ?? null;
}

/** Objetivo para infectar (Gusano): system no infectado. */
export function pickInfectTarget(room: Room, actorId: string): string | null {
  const candidates = aliveOthers(room, actorId).filter(
    (p) => p.team === Team.SYSTEM && !isInfected(p),
  );
  const pool = candidates.length
    ? candidates
    : aliveOthers(room, actorId).filter((p) => !isInfected(p));
  return pickRandom(pool)?.id ?? null;
}

/** Objetivo para proteger (Antivirus): aliado system con más sospecha o infectado. */
export function pickProtectTarget(room: Room, actor: Player): string | null {
  const allies = aliveOthers(room, actor.id).filter((p) => p.team === actor.team);
  const pool = allies.length ? allies : aliveOthers(room, actor.id);
  const infected = pool.filter((p) => isInfected(p));
  if (infected.length) return infected[0].id;
  const scores = computeSuspicionScores(room);
  return pickHighestSuspicion(pool, scores)?.id ?? pickRandom(pool)?.id ?? null;
}
