import {
  GamePhase,
  IncidentReport,
  PublicGameState,
  PublicPlayer,
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
  }));

  return {
    roomId: raw?.roomId ?? '',
    phase: (raw?.phase ?? 'LOBBY') as GamePhase,
    phaseStartedAt: raw?.phaseStartedAt ?? Date.now(),
    players,
    dayNumber: raw?.dayNumber ?? 0,
    nightNumber: raw?.nightNumber ?? 0,
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
): IncidentReport[] {
  if (!previous) return [];

  const prevById = new Map(previous.players.map((p) => [p.id, p]));
  const incidents: IncidentReport[] = [];

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
): IncidentReport[] {
  const byId = new Map((state?.players ?? []).map((p) => [p.id, p]));
  return disconnected.map((id) => ({
    playerId: id,
    playerName: byId.get(id)?.name ?? id,
  }));
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
