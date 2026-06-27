import { RoomPlayer } from '../models/game-state.model';
import { winnerLabel, winnerTeamName } from './game.utils';

export interface GameOverReveal {
  title: string;
  items: string[];
}

export interface GameOverView {
  didWin: boolean;
  headline: string;
  /** Etiqueta fija: "Equipo ganador" o "Ganador" */
  winnerKicker: string;
  /** Nombre del equipo o jugador que ganó la partida */
  winningSideLabel: string;
  /** Tu resultado personal */
  personalResult: string;
  message: string;
  reveals: GameOverReveal[];
}

export interface SoloWinnerInfo {
  playerId: string;
  role: string;
  reason: string;
}

const SOLO_VICTORY_NARRATIVE: Record<string, string> = {
  troll_banned: 'Provocó hasta que lo expulsaron — así gana el Troll.',
  worm_last_standing: 'Sobrevivió como el último jugador en pie.',
  miner_survived: 'Sobrevivió como el último jugador en pie.',
  chaotic_stalemate_break: 'El caos ganó en el desempate final.',
};

function soloVictoryNarrative(reason: string): string {
  return SOLO_VICTORY_NARRATIVE[reason] ?? 'Cumplió su condición de victoria en solitario.';
}

export function buildGameOverView(
  myTeam: string | undefined,
  myPlayerId: string,
  winner: string | null | undefined,
  soloWinner: SoloWinnerInfo | null | undefined,
  players: RoomPlayer[],
): GameOverView {
  const viewerTeam = resolveViewerTeam(myTeam, myPlayerId, players);
  const didWin = viewerDidWin(viewerTeam, myPlayerId, winner, soloWinner);
  const winningSideLabel = resolveWinningSideLabel(winner, soloWinner, players);
  const winnerKicker = soloWinner || winner === 'chaotic' ? 'Ganador' : 'Equipo ganador';

  return {
    didWin,
    headline: didWin ? '¡VICTORIA!' : 'DERROTA',
    winnerKicker,
    winningSideLabel,
    personalResult: didWin ? 'Tu bando ha ganado la partida.' : 'Tu bando no ha ganado esta partida.',
    message: resolveMessage(didWin, winner, soloWinner, players, winningSideLabel),
    reveals: buildReveals(winner, soloWinner, players),
  };
}

function resolveViewerTeam(
  myTeam: string | undefined,
  myPlayerId: string,
  players: RoomPlayer[],
): string | undefined {
  if (myTeam) return myTeam;
  return players.find((p) => p.id === myPlayerId)?.team;
}

function viewerDidWin(
  myTeam: string | undefined,
  myPlayerId: string,
  winner: string | null | undefined,
  soloWinner?: SoloWinnerInfo | null,
): boolean {
  if (soloWinner) {
    return soloWinner.playerId === myPlayerId;
  }
  if (!winner || !myTeam) {
    return false;
  }
  return myTeam === winner;
}

function resolveWinningSideLabel(
  winner: string | null | undefined,
  soloWinner: SoloWinnerInfo | null | undefined,
  players: RoomPlayer[],
): string {
  if (soloWinner) {
    const name = players.find((p) => p.id === soloWinner.playerId)?.name ?? soloWinner.playerId;
    return `${name} (${soloWinner.role})`;
  }
  if (winner === 'chaotic') {
    const chaotic = pickChaoticWinnerPlayer(players);
    if (chaotic) {
      return `${chaotic.name} (${chaotic.role ?? 'Caótico'})`;
    }
    return 'Equipo Caótico';
  }
  return winnerTeamName(winner);
}

function resolveMessage(
  didWin: boolean,
  winner: string | null | undefined,
  soloWinner: SoloWinnerInfo | null | undefined,
  players: RoomPlayer[],
  winningSideLabel: string,
): string {
  if (soloWinner) {
    const narrative = soloVictoryNarrative(soloWinner.reason);
    if (didWin) {
      return `Has ganado en solitario. ${narrative}`;
    }
    return `Ganó ${winningSideLabel}. ${narrative}`;
  }

  if (winner === 'chaotic') {
    return didWin
      ? 'Has ganado con tu rol caótico.'
      : `${winningSideLabel} ha ganado la partida.`;
  }

  if (winner) {
    const teamLabel = winnerLabel(winner);
    if (didWin) {
      return `${teamLabel} Tu equipo ha cumplido su objetivo.`;
    }
    return `Ganó ${winningSideLabel}. ${teamLabel}`;
  }

  return 'La partida ha terminado.';
}

function buildReveals(
  winner: string | null | undefined,
  soloWinner: SoloWinnerInfo | null | undefined,
  players: RoomPlayer[],
): GameOverReveal[] {
  if (soloWinner || winner === 'chaotic') {
    return [];
  }

  if (winner === 'system') {
    const systemPlayers = players.filter((p) => p.team === 'system');
    return [
      {
        title: 'Jugadores del equipo Sistema',
        items: systemPlayers.length
          ? systemPlayers.map(formatPlayerReveal)
          : ['Sin datos de roles.'],
      },
    ];
  }

  if (winner === 'black_hat') {
    const hackers = players.filter((p) => p.team === 'black_hat');
    return [
      {
        title: 'Jugadores del equipo Hacker',
        items: hackers.length
          ? hackers.map(formatPlayerReveal)
          : ['Sin datos de roles.'],
      },
    ];
  }

  return [];
}

function pickChaoticWinnerPlayer(players: RoomPlayer[]): RoomPlayer | undefined {
  const aliveChaotics = players.filter((p) => p.team === 'chaotic' && p.isAlive);
  if (aliveChaotics.length >= 1) return aliveChaotics[0];
  return players.find((p) => p.team === 'chaotic');
}

function formatPlayerReveal(player: RoomPlayer): string {
  const role = player.role ?? 'Rol desconocido';
  const status = player.isAlive ? 'vivo' : 'eliminado';
  return `${player.name} — ${role} (${status})`;
}
