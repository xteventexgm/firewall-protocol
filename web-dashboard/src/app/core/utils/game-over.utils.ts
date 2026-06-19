import {
  GameOverPayload,
  GameOverReveal,
  GameOverSummary,
  PublicGameState,
  PublicPlayer,
  SoloWinner,
  Team,
} from '../models/game-state.model';
import { winnerLabel, winnerTeamName } from './game.utils';

const SOLO_REASON_MESSAGES: Record<string, string> = {
  troll_banned: 'Expulsado por votación — victoria del Troll.',
  worm_last_standing: 'Último nodo en pie — victoria del Gusano.',
  miner_survived: 'Supervivencia confirmada — victoria del Minero de Cripto.',
};

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
    const reason = SOLO_REASON_MESSAGES[soloWinner.reason] ?? soloWinner.reason;
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
      message: teamWinMessage(winner),
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

function teamWinMessage(winner: Team): string {
  const messages: Record<Team, string> = {
    system: 'El equipo SISTEMA ha restaurado la red.',
    black_hat: 'El equipo BLACK HAT ha comprometido la infraestructura.',
    chaotic: 'El caos ha prevalecido en la red.',
  };
  return messages[winner] ?? winnerLabel(winner);
}

function buildHostReveals(
  winner: Team | null,
  soloWinner: SoloWinner | null,
  players: PublicPlayer[],
): GameOverReveal[] {
  const reveals: GameOverReveal[] = [];
  const hackers = players.filter((p) => isBlackHatRole(p.role));
  const solos = players.filter((p) => isChaoticRole(p.role));
  const systemPlayers = players.filter((p) => isSystemRole(p.role));
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
        SOLO_REASON_MESSAGES[soloWinner.reason] ?? soloWinner.reason,
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
