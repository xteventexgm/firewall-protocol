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
    joinedAt: p.joinedAt ?? Date.now(),
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
    const resolvedTarget = target === 'null' ? '' : target;
    if (!resolvedTarget) continue;
    for (const voter of voters) {
      lastVote.set(voter, resolvedTarget);
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
    LOBBY: 'LOBBY — Esperando conexiones',
    REPARTO: 'REPARTO — Asignando roles',
    NOCHE: 'NOCHE — Operaciones encubiertas',
    DIA: 'DÍA — Auditoría de seguridad',
    VOTACION: 'VOTACIÓN — Debate activo',
    VERIFICACION: 'VERIFICACIÓN — Conteo de votos',
    FIN: 'FIN — Partida terminada',
  };
  return labels[phase] ?? phase;
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
  const players = state?.players ?? [];

  if (payload.soloWinner) {
    const player = players.find((p) => p.id === payload.soloWinner!.playerId);
    const playerName = player?.name ?? payload.soloWinner.playerId;
    return {
      headline: `Victoria solitaria — ${playerName}`,
      winners: [{ playerName, role: payload.soloWinner.role }],
    };
  }

  if (payload.winner) {
    return {
      headline: winnerLabel(payload.winner),
      winners: [{ playerName: winnerTeamName(payload.winner), role: 'Equipo ganador' }],
    };
  }

  return { headline: 'Partida terminada', winners: [] };
}

export function buildGameOverSummary(state: PublicGameState | null): GameOverSummary | null {
  if (!state || state.phase !== 'FIN') return null;

  return buildGameOverSummaryFromPayload(
    { roomId: state.roomId, winner: state.winner, soloWinner: state.soloWinner },
    state,
  );
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
