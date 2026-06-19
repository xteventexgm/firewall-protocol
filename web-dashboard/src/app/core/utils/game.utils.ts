import {
  GameOverPayload,
  GameOverSummary,
  GamePhase,
  IncidentDisplay,
  PublicGameState,
  PublicPlayer,
  Team,
  VoteEdge,
} from '../models/game-state.model';
import { buildHostGameOverFromState, buildHostGameOverSummary } from './game-over.utils';

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `FIRE-${suffix}`;
}

export function sanitizeGameState(raw: any): PublicGameState {
  const players: PublicPlayer[] = (raw?.players ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    isAlive: p.isAlive !== false,
    isConnected: p.isConnected !== false,
    silenced: p.silenced === true,
    role: p.role ?? undefined,
  }));

  return {
    roomId: (raw?.roomId ?? '').toUpperCase(),
    phase: (raw?.phase ?? 'LOBBY') as GamePhase,
    phaseStartedAt: raw?.phaseStartedAt ?? Date.now(),
    players,
    dayNumber: raw?.dayNumber ?? 0,
    nightNumber: raw?.nightNumber ?? 0,
    maxPlayers: raw?.maxPlayers ?? players.length,
    playerCount: raw?.playerCount ?? players.length,
    votes: raw?.votes ?? {},
    winner: raw?.winner ?? null,
    soloWinner: raw?.soloWinner ?? null,
  };
}

export function toVoteEdges(votes: Record<string, string[]>): VoteEdge[] {
  const lastVote = new Map<string, string>();
  for (const [target, voters] of Object.entries(votes)) {
    if (target === 'null' || target === 'skip') continue;
    for (const voter of voters) {
      lastVote.set(voter, target);
    }
  }
  return [...lastVote.entries()].map(([from, to]) => ({ from, to }));
}

export function detectIncidents(
  previous: PublicGameState | null,
  current: PublicGameState,
): IncidentDisplay[] {
  if (!previous) return [];

  const prevById = new Map(previous.players.map((p) => [p.id, p]));
  const incidents: IncidentDisplay[] = [];

  for (const player of current.players) {
    const prev = prevById.get(player.id);
    if (prev?.isAlive && !player.isAlive) {
      incidents.push({ playerId: player.id, playerName: player.name });
    }
  }

  return incidents;
}

export function incidentsFromServerReport(
  disconnected: string[],
  state: PublicGameState | null,
): IncidentDisplay[] {
  const byId = new Map((state?.players ?? []).map((p) => [p.id, p]));
  return disconnected.map((id) => {
    const player = byId.get(id);
    return {
      playerId: id,
      playerName: player?.name ?? id,
      role: player?.role,
    };
  });
}

export function phaseLabel(phase: GamePhase): string {
  const labels: Record<GamePhase, string> = {
    LOBBY: 'EN ESPERA',
    REPARTO: 'REPARTO DE ROLES',
    NOCHE: 'OPERACIÓN NOCTURNA',
    DIA: 'AUDITORÍA DIURNA',
    VOTACION: 'VOTACIÓN PÚBLICA',
    VERIFICACION: 'VERIFICACIÓN',
    FIN: 'PARTIDA TERMINADA',
  };
  return labels[phase] ?? phase;
}

export function translateEliminationReason(reason: string): string {
  const labels: Record<string, string> = {
    vote: 'votación',
    honeypot_drag: 'arrastre honeypot',
  };
  return labels[reason] ?? reason;
}

export function teamLabelFromKey(team: string | undefined): string {
  const labels: Record<string, string> = {
    system: 'Equipo Sistema',
    black_hat: 'Equipo Black Hat',
    chaotic: 'Equipo Caótico',
  };
  return team ? (labels[team] ?? team) : '';
}

export function isNodeCritical(player: PublicPlayer): boolean {
  return !player.isAlive || !player.isConnected;
}

export function winnerLabel(winner: Team | null | undefined): string {
  const labels: Record<Team, string> = {
    system: 'El SISTEMA ha restaurado la red',
    black_hat: 'BLACK HAT ha comprometido la infraestructura',
    chaotic: 'El caos ha prevalecido',
  };
  return winner ? (labels[winner] ?? `Ganador: ${winner}`) : 'Partida terminada';
}

export function winnerTeamName(winner: Team | null | undefined): string {
  const labels: Record<Team, string> = {
    system: 'SISTEMA',
    black_hat: 'BLACK HAT',
    chaotic: 'CAÓTICO',
  };
  return winner ? (labels[winner] ?? winner.toUpperCase()) : '—';
}

export function buildGameOverSummaryFromPayload(
  payload: GameOverPayload,
  state: PublicGameState | null,
): GameOverSummary {
  return buildHostGameOverSummary(payload, state);
}

export function buildGameOverSummary(state: PublicGameState | null): GameOverSummary | null {
  return buildHostGameOverFromState(state);
}

export function detectPlayerStatusChanges(
  previous: PublicGameState | null,
  current: PublicGameState,
): string[] {
  if (!previous) return [];

  const messages: string[] = [];
  const prevById = new Map(previous.players.map((p) => [p.id, p]));

  for (const player of current.players) {
    const prev = prevById.get(player.id);
    if (!prev) continue;

    if (prev.isConnected && !player.isConnected) {
      messages.push(`Nodo desconectado: ${player.name}`);
    } else if (!prev.isConnected && player.isConnected) {
      messages.push(`Nodo reconectado: ${player.name}`);
    } else if (prev.isAlive && !player.isAlive) {
      const roleLabel = player.role ? ` — ${player.role}` : '';
      messages.push(`Nodo eliminado: ${player.name}${roleLabel}`);
    }
  }

  return messages;
}
