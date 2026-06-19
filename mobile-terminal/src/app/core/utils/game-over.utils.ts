import { RoomPlayer } from '../models/game-state.model';
import { winnerLabel, winnerTeamName } from './game.utils';

export interface GameOverReveal {
  title: string;
  items: string[];
}

export interface GameOverView {
  didWin: boolean;
  headline: string;
  winnerTeam: string;
  message: string;
  reveals: GameOverReveal[];
}

export interface SoloWinnerInfo {
  playerId: string;
  role: string;
  reason: string;
}

export function buildGameOverView(
  myTeam: string | undefined,
  myPlayerId: string,
  winner: string | null | undefined,
  soloWinner: SoloWinnerInfo | null | undefined,
  players: RoomPlayer[],
): GameOverView {
  const didWin = viewerDidWin(myTeam, myPlayerId, winner, soloWinner);
  const winningSide = resolveWinningSide(winner, soloWinner);

  return {
    didWin,
    headline: didWin ? 'GANADOR' : 'DERROTA',
    winnerTeam: resolveWinnerTeamLabel(winner, soloWinner, players),
    message: resolveMessage(didWin, winner, soloWinner, players),
    reveals: buildReveals(didWin, myTeam, winningSide, winner, soloWinner, players),
  };
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

function resolveWinningSide(
  winner: string | null | undefined,
  soloWinner?: SoloWinnerInfo | null,
): 'solo' | 'system' | 'black_hat' | 'chaotic' | null {
  if (soloWinner) {
    return 'solo';
  }
  if (winner === 'system' || winner === 'black_hat' || winner === 'chaotic') {
    return winner;
  }
  return null;
}

function resolveWinnerTeamLabel(
  winner: string | null | undefined,
  soloWinner: SoloWinnerInfo | null | undefined,
  players: RoomPlayer[],
): string {
  if (soloWinner) {
    const name = players.find((p) => p.id === soloWinner.playerId)?.name ?? soloWinner.playerId;
    return `${name} (${soloWinner.role})`;
  }
  return winnerTeamName(winner);
}

function resolveMessage(
  didWin: boolean,
  winner: string | null | undefined,
  soloWinner: SoloWinnerInfo | null | undefined,
  players: RoomPlayer[],
): string {
  if (soloWinner) {
    const name = players.find((p) => p.id === soloWinner.playerId)?.name ?? soloWinner.playerId;
    if (didWin) {
      return `Has prevalecido como jugador solitario (${soloWinner.role}).`;
    }
    return `Victoria solitaria: ${name} (${soloWinner.role}).`;
  }

  if (didWin) {
    return winnerLabel(winner);
  }

  const lossMessages: Record<string, string> = {
    system: 'El SISTEMA ha restaurado la red.',
    black_hat: 'BLACK HAT ha comprometido la infraestructura.',
    chaotic: 'El caos ha prevalecido.',
  };
  return winner ? (lossMessages[winner] ?? winnerLabel(winner)) : 'Partida terminada.';
}

function buildReveals(
  didWin: boolean,
  myTeam: string | undefined,
  winningSide: ReturnType<typeof resolveWinningSide>,
  winner: string | null | undefined,
  soloWinner: SoloWinnerInfo | null | undefined,
  players: RoomPlayer[],
): GameOverReveal[] {
  const reveals: GameOverReveal[] = [];
  const hackers = players.filter((p) => p.team === 'black_hat');
  const solos = players.filter((p) => p.team === 'chaotic');

  if (winningSide === 'system') {
    if (didWin && hackers.length) {
      reveals.push({
        title: 'Hackers eliminados',
        items: hackers.map(formatPlayerReveal),
      });
    } else if (!didWin && myTeam === 'black_hat') {
      reveals.push({
        title: 'Tu equipo ha caído',
        items: hackers.map(formatPlayerReveal),
      });
    }

    if (solos.length) {
      reveals.push({
        title: 'Roles caóticos en la partida',
        items: solos.map(formatPlayerReveal),
      });
    }
  }

  if (winningSide === 'black_hat') {
    if (didWin && hackers.length) {
      reveals.push({
        title: 'Equipo Black Hat victorioso',
        items: hackers.map(formatPlayerReveal),
      });
    } else if (!didWin) {
      reveals.push({
        title: 'Atacantes identificados',
        items: hackers.map(formatPlayerReveal),
      });
    }
  }

  if (winningSide === 'solo' && soloWinner) {
    const soloPlayer = players.find((p) => p.id === soloWinner.playerId);
    const soloLine = soloPlayer
      ? formatPlayerReveal(soloPlayer)
      : `${soloWinner.playerId} — ${soloWinner.role}`;

    if (didWin) {
      reveals.push({
        title: 'Victoria solitaria confirmada',
        items: [soloLine],
      });
    } else {
      reveals.push({
        title: 'Jugador solitario revelado',
        items: [soloLine],
      });
    }

    if (hackers.length) {
      reveals.push({
        title: 'Hackers en la partida',
        items: hackers.map(formatPlayerReveal),
      });
    }
  }

  if (winningSide === 'chaotic' && winner === 'chaotic') {
    if (solos.length) {
      reveals.push({
        title: 'Roles caóticos',
        items: solos.map(formatPlayerReveal),
      });
    }
  }

  return reveals.filter((r) => r.items.length > 0);
}

function formatPlayerReveal(player: RoomPlayer): string {
  const role = player.role ?? 'Rol desconocido';
  const status = player.isAlive ? 'VIVO' : 'ELIMINADO';
  return `${player.name} — ${role} [${status}]`;
}
