import {
  GameOverPayload,
  GameOverReveal,
  GameOverSummary,
  PublicGameState,
  PublicPlayer,
  SoloWinner,
  Team,
} from '../models/game-state.model';
import { winnerLabel, winnerTeamName, roleTeamHint } from './game.utils';

function resolvePlayerTeam(player: PublicPlayer): Team | null {
  return player.team ?? roleTeamHint(player.role);
}

const SOLO_VICTORY_NARRATIVE: Record<string, string> = {
  troll_banned: 'Provocó el caos hasta ser expulsado — victoria del Troll.',
  worm_last_standing: 'Infectó la red hasta quedar como único nodo en pie.',
  miner_survived: 'Parasitó la infraestructura y sobrevivió como último nodo activo.',
  chaotic_stalemate_break: 'El caos prevaleció en el desempate final de la red.',
};

function soloVictoryNarrative(reason: string): string {
  return SOLO_VICTORY_NARRATIVE[reason] ?? 'Ha cumplido su victoria solitaria.';
}

export function buildHostGameOverSummary(
  payload: GameOverPayload,
  state: PublicGameState | null,
): GameOverSummary {
  const players = state?.players ?? [];
  const winner = payload.winner ?? state?.winner ?? null;
  const soloWinner = payload.soloWinner ?? state?.soloWinner ?? null;

  if (soloWinner) {
    const player = players.find((p) => p.id === soloWinner.playerId);
    const playerName = player?.name ?? soloWinner.playerId;
    const reason = soloVictoryNarrative(soloWinner.reason);
    return {
      headline: `Victoria caótica — ${playerName}`,
      message: `${soloWinner.role}. ${reason}`,
      winners: [{ playerName, role: soloWinner.role }],
      reveals: [],
      outcome: 'neutral',
    };
  }

  if (winner === 'chaotic') {
    const chaotic = pickChaoticWinnerPlayer(players);
    const playerName = chaotic?.name ?? 'Jugador caótico';
    const role = chaotic?.role ?? 'Rol caótico';
    return {
      headline: `Victoria caótica — ${playerName}`,
      message: `${role} ha prevalecido en la red.`,
      winners: [{ playerName, role }],
      reveals: [],
      outcome: 'neutral',
    };
  }

  if (winner) {
    return {
      headline: winnerLabel(winner),
      message: teamWinMessage(winner, players),
      winners: [{ playerName: winnerTeamName(winner), role: 'Equipo ganador' }],
      reveals: buildHostReveals(winner, players),
      outcome: winner === 'system' ? 'win' : 'loss',
    };
  }

  return {
    headline: 'Partida terminada',
    message: 'La partida ha concluido.',
    winners: [],
    reveals: [],
    outcome: 'neutral',
  };
}

export function buildHostGameOverFromState(state: PublicGameState | null): GameOverSummary | null {
  if (!state || state.phase !== 'FIN') return null;
  return buildHostGameOverSummary(
    { roomId: state.roomId, winner: state.winner, soloWinner: state.soloWinner },
    state,
  );
}

function teamWinMessage(winner: Team, players: PublicPlayer[]): string {
  const messages: Record<Team, string> = {
    system: 'El equipo Sistema ha restaurado la red.',
    black_hat: 'El equipo Hacker ha comprometido la infraestructura.',
    chaotic: 'El caos ha prevalecido en la red.',
  };
  const base = messages[winner] ?? winnerLabel(winner);
  if (winner !== 'system' && winner !== 'black_hat') return base;

  const aliveWithTeam = players.filter((p) => p.isAlive && resolvePlayerTeam(p));
  const hackersAlive = aliveWithTeam.filter((p) => resolvePlayerTeam(p) === 'black_hat').length;
  const systemAlive = aliveWithTeam.filter((p) => resolvePlayerTeam(p) === 'system').length;
  const chaoticsAlive = aliveWithTeam.filter((p) => resolvePlayerTeam(p) === 'chaotic').length;
  return (
    `${base} Al cierre: ${hackersAlive} hacker(s), ${systemAlive} system, ${chaoticsAlive} caótico(s) vivos.`
  );
}

function buildHostReveals(winner: Team, players: PublicPlayer[]): GameOverReveal[] {
  if (winner === 'system') {
    const systemPlayers = players.filter((p) => resolvePlayerTeam(p) === 'system');
    return [
      {
        title: 'Roles del equipo Sistema',
        items: systemPlayers.length
          ? systemPlayers.map(formatPlayerReveal)
          : ['No hay roles registrados del equipo Sistema.'],
      },
    ];
  }

  if (winner === 'black_hat') {
    const hackers = players.filter((p) => resolvePlayerTeam(p) === 'black_hat');
    return [
      {
        title: 'Roles del equipo Hacker',
        items: hackers.length
          ? hackers.map(formatPlayerReveal)
          : ['No hay roles registrados del equipo Hacker.'],
      },
    ];
  }

  return [];
}

function pickChaoticWinnerPlayer(players: PublicPlayer[]): PublicPlayer | undefined {
  const aliveChaotics = players.filter((p) => resolvePlayerTeam(p) === 'chaotic' && p.isAlive);
  if (aliveChaotics.length >= 1) return aliveChaotics[0];
  return players.find((p) => resolvePlayerTeam(p) === 'chaotic');
}

function formatPlayerReveal(player: PublicPlayer): string {
  const role = player.role ?? 'Rol desconocido';
  const status = player.isAlive ? 'VIVO' : 'ELIMINADO';
  return `${player.name} — ${role} [${status}]`;
}
