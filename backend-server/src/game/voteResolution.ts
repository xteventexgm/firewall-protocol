/**
 * Resolución de votación diurna (fase VOTACION).
 *
 * Extraído de Room para testear empates y mayoría sin socket.
 * Empate o sin votos → `voteTied`; mayoría simple → un eliminado.
 */
import { VoteTiedPayload } from '../types/events.types';

/** Resultado de conteo de votos diurnos. */
export type VoteResolution = {
  eliminated: string | null;
  tied: boolean;
  skipVotes: number;
  voteCount: number;
  candidates: string[];
  reason: 'eliminated' | 'tie' | 'no_votes';
};

/** Eventos derivados del conteo (empate o eliminado). */
export type VoteResolutionEvents = {
  voteTied?: VoteTiedPayload;
  eliminatedPlayerId?: string;
};

/**
 * Resuelve votación diurna.
 * Empate perfecto (ej. 2 votos A, 2 votos B) → nadie eliminado, reason 'tie'.
 * Sin votos de eliminación → reason 'no_votes'.
 */
export function computeVoteResolution(
  roomId: string,
  votes: Record<string, string[]>,
  alivePlayerIds: Set<string>,
): { resolution: VoteResolution; events: VoteResolutionEvents } {
  const tallies = new Map<string, number>();
  const skipVotes = (votes['skip'] ?? []).filter((v) => alivePlayerIds.has(v)).length;

  for (const [target, voters] of Object.entries(votes)) {
    if (target === 'skip' || target === 'null') continue;
    const validVotes = voters.filter((v) => alivePlayerIds.has(v));
    if (validVotes.length > 0) {
      tallies.set(target, validVotes.length);
    }
  }

  if (tallies.size === 0) {
    return {
      resolution: {
        eliminated: null,
        tied: true,
        skipVotes,
        voteCount: 0,
        candidates: [],
        reason: 'no_votes',
      },
      events: {
        voteTied: {
          roomId,
          voteCount: 0,
          candidates: [],
          skipVotes,
          reason: 'no_votes',
        },
      },
    };
  }

  const maxVotes = Math.max(...tallies.values());
  const leaders = [...tallies.entries()].filter(([, count]) => count === maxVotes);
  const candidates = leaders.map(([target]) => target);

  if (leaders.length > 1) {
    return {
      resolution: {
        eliminated: null,
        tied: true,
        skipVotes,
        voteCount: maxVotes,
        candidates,
        reason: 'tie',
      },
      events: {
        voteTied: {
          roomId,
          voteCount: maxVotes,
          candidates,
          skipVotes,
          reason: 'tie',
        },
      },
    };
  }

  const [bestTarget, bestCount] = leaders[0];
  return {
    resolution: {
      eliminated: bestTarget,
      tied: false,
      skipVotes,
      voteCount: bestCount,
      candidates: [bestTarget],
      reason: 'eliminated',
    },
    events: {
      eliminatedPlayerId: bestTarget,
    },
  };
}
