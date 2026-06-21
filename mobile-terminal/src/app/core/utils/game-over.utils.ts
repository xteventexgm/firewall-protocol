import { RoomPlayer } from '../models/game-state.model';
import { winnerLabel, winnerTeamName } from './game.utils';

export interface GameOverReveal {
  title: string;
  items: string[];
}

export interface GameOverView {
  didWin: boolean;
  headline: string;
  winnerSideTitle: string;
  winnerTeam: string;
  message: string;
  reveals: GameOverReveal[];
}

export interface SoloWinnerInfo {
  playerId: string;
  role: string;
  reason: string;
}

const SOLO_REASON_MESSAGES: Record<string, string> = {
  troll_banned: 'Expulsado por votación — victoria del Troll.',
  worm_last_standing: 'Último nodo en pie — victoria del Gusano.',
  miner_survived: 'Supervivencia confirmada — victoria del Minero de Cripto.',
};

export function buildGameOverView(
  myTeam: string | undefined,
  myPlayerId: string,
  winner: string | null | undefined,
  soloWinner: SoloWinnerInfo | null | undefined,
  players: RoomPlayer[],
): GameOverView {
  const didWin = viewerDidWin(myTeam, myPlayerId, winner, soloWinner);
  const winningSide = resolveWinningSide(winner, soloWinner);
  const winnerSideTitle = resolveWinnerSideTitle(winner, soloWinner);
  const winnerTeam = resolveWinnerTeamLabel(winner, soloWinner, players);

  return {
    didWin,
    headline: didWin ? '¡VICTORIA!' : 'DERROTA',
    winnerSideTitle,
    winnerTeam,
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

function resolveWinnerSideTitle(
  winner: string | null | undefined,
  soloWinner: SoloWinnerInfo | null | undefined,
): string {
  if (soloWinner) {
    return 'VICTORIA SOLITARIA';
  }
  if (winner === 'system') return 'VICTORIA DEL SISTEMA';
  if (winner === 'black_hat') return 'VICTORIA BLACK HAT';
  if (winner === 'chaotic') return 'VICTORIA CAÓTICA';
  return 'FIN DE PARTIDA';
}

function resolveWinnerTeamLabel(
  winner: string | null | undefined,
  soloWinner: SoloWinnerInfo | null | undefined,
  players: RoomPlayer[],
): string {
  if (soloWinner) {
    const name = players.find((p) => p.id === soloWinner.playerId)?.name ?? soloWinner.playerId;
    return `${name} · ${soloWinner.role}`;
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
    const reason = SOLO_REASON_MESSAGES[soloWinner.reason] ?? `Condición: ${soloWinner.reason}`;
    if (didWin) {
      return `Has ganado en solitario como ${soloWinner.role}. ${reason}`;
    }
    return `${name} (${soloWinner.role}) ha ganado en solitario. ${reason}`;
  }

  if (didWin && winner) {
    return winnerLabel(winner);
  }

  const lossMessages: Record<string, string> = {
    system: 'El equipo SISTEMA ha restaurado la red.',
    black_hat: 'El equipo BLACK HAT ha comprometido la infraestructura.',
    chaotic: 'El caos ha prevalecido en la red.',
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
  const hackers = players.filter((p) => p.team === 'black_hat' || isBlackHatRole(p.role));
  const solos = players.filter((p) => p.team === 'chaotic' || isChaoticRole(p.role));
  const systemPlayers = players.filter((p) => p.team === 'system' || isSystemRole(p.role));

  if (winningSide === 'system') {
    reveals.push({
      title: 'Equipo ganador — SISTEMA',
      items: systemPlayers.length
        ? systemPlayers.map(formatPlayerReveal)
        : ['El Sistema restauró la integridad de la red.'],
    });
    if (hackers.length) {
      reveals.push({
        title: 'Black Hat en la partida',
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
    reveals.push({
      title: 'Equipo ganador — BLACK HAT',
      items: hackers.length
        ? hackers.map(formatPlayerReveal)
        : ['Los atacantes han tomado control de la infraestructura.'],
    });
    if (!didWin && systemPlayers.length) {
      reveals.push({
        title: 'Nodos del Sistema',
        items: systemPlayers.map(formatPlayerReveal),
      });
    }
  }

  if (winningSide === 'solo' && soloWinner) {
    const soloPlayer = players.find((p) => p.id === soloWinner.playerId);
    const soloLine = soloPlayer
      ? formatPlayerReveal(soloPlayer)
      : `${soloWinner.playerId} — ${soloWinner.role}`;

    reveals.push({
      title: `Ganador solitario — ${soloWinner.role}`,
      items: [soloLine, SOLO_REASON_MESSAGES[soloWinner.reason] ?? soloWinner.reason],
    });

    if (hackers.length) {
      reveals.push({ title: 'Black Hat en la partida', items: hackers.map(formatPlayerReveal) });
    }
    if (solos.length > 1) {
      reveals.push({
        title: 'Otros roles caóticos',
        items: solos.filter((p) => p.id !== soloWinner.playerId).map(formatPlayerReveal),
      });
    }
  }

  if (winningSide === 'chaotic' && winner === 'chaotic' && solos.length) {
    reveals.push({ title: 'Roles caóticos', items: solos.map(formatPlayerReveal) });
  }

  return reveals.filter((r) => r.items.length > 0);
}

function formatPlayerReveal(player: RoomPlayer): string {
  const role = player.role ?? 'Rol desconocido';
  const status = player.isAlive ? 'VIVO' : 'ELIMINADO';
  return `${player.name} — ${role} [${status}]`;
}

function isBlackHatRole(role?: string): boolean {
  return !!role && ['DDoS Operator', 'Rootkit', 'Ransomware', 'Spyware', 'Phisher'].includes(role);
}

function isChaoticRole(role?: string): boolean {
  return !!role && ['Troll', 'Gusano', 'Minero de Cripto', 'Zero-Day'].includes(role);
}

function isSystemRole(role?: string): boolean {
  return (
    !!role &&
    ['SysAdmin', 'Analista SOC', 'Antivirus', 'Pentester', 'Honeypot', 'Deep Freeze', 'Enrutador BGP'].includes(
      role,
    )
  );
}
