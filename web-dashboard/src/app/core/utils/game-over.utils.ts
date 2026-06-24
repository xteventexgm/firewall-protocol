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
      headline: `Victoria solitaria — ${playerName}`,
      message: `${soloWinner.role}. ${reason}`,
      winners: [{ playerName, role: soloWinner.role }],
      reveals: buildHostReveals(winner, soloWinner, players),
      outcome: 'neutral',
    };
  }

  if (winner) {
    return {
      headline: winnerLabel(winner),
      message: teamWinMessage(winner, players),
      winners: [{ playerName: winnerTeamName(winner), role: 'Equipo ganador' }],
      reveals: buildHostReveals(winner, null, players),
      outcome: winner === 'system' ? 'win' : 'loss',
    };
  }

  return {
    headline: 'Partida terminada',
    message: 'La partida ha concluido.',
    winners: [],
    reveals: buildHostReveals(null, null, players),
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
    system: 'El equipo SISTEMA ha restaurado la red.',
    black_hat: 'El equipo BLACK HAT ha comprometido la infraestructura.',
    chaotic: 'El caos ha prevalecido en la red.',
  };
  const base = messages[winner] ?? winnerLabel(winner);
  if (winner !== 'system' && winner !== 'black_hat') return base;

  const aliveWithTeam = players.filter((p) => p.isAlive && resolvePlayerTeam(p));
  const hackersAlive = aliveWithTeam.filter((p) => resolvePlayerTeam(p) === 'black_hat').length;
  const systemAlive = aliveWithTeam.filter((p) => resolvePlayerTeam(p) === 'system').length;
  const chaoticsAlive = aliveWithTeam.filter((p) => resolvePlayerTeam(p) === 'chaotic').length;
  return (
    `${base} Al cierre: ${hackersAlive} hacker(s), ${systemAlive} system, ${chaoticsAlive} caótico(s) vivos. ` +
    'System gana con 0 hackers y 0 caóticos; Black Hat con 0 system y mayoría sobre caóticos si quedan.'
  );
}

function buildHostReveals(
  winner: Team | null,
  soloWinner: SoloWinner | null,
  players: PublicPlayer[],
): GameOverReveal[] {
  const reveals: GameOverReveal[] = [];
  const hackers = players.filter((p) => resolvePlayerTeam(p) === 'black_hat');
  const solos = players.filter((p) => resolvePlayerTeam(p) === 'chaotic');
  const systemPlayers = players.filter((p) => resolvePlayerTeam(p) === 'system');
  const withRoles = players.filter((p) => p.role);

  if (winner === 'system') {
    reveals.push({
      title: 'Equipo ganador — SISTEMA',
      items: systemPlayers.length
        ? systemPlayers.map(formatPlayerReveal)
        : ['El Sistema restauró la integridad de la red.'],
    });
  }

  if (winner === 'black_hat') {
    reveals.push({
      title: 'Equipo ganador — BLACK HAT',
      items: hackers.length
        ? hackers.map(formatPlayerReveal)
        : ['Los atacantes han tomado control de la infraestructura.'],
    });
  }

  if (winner === 'chaotic' && solos.length) {
    reveals.push({ title: 'Equipo ganador — CAÓTICO', items: solos.map(formatPlayerReveal) });
  }

  if (soloWinner) {
    const soloPlayer = players.find((p) => p.id === soloWinner.playerId);
    reveals.unshift({
      title: `Ganador solitario — ${soloWinner.role}`,
      items: [
        soloPlayer ? formatPlayerReveal(soloPlayer) : `${soloWinner.playerId} — ${soloWinner.role}`,
        soloVictoryNarrative(soloWinner.reason),
      ],
    });
  }

  if (withRoles.length && !reveals.some((r) => r.title === 'Todos los roles revelados')) {
    reveals.push({
      title: 'Todos los roles revelados',
      items: withRoles.map(formatPlayerReveal),
    });
  }

  return reveals.filter((r) => r.items.length > 0);
}

function formatPlayerReveal(player: PublicPlayer): string {
  const role = player.role ?? 'Rol desconocido';
  const status = player.isAlive ? 'VIVO' : 'ELIMINADO';
  return `${player.name} — ${role} [${status}]`;
}
