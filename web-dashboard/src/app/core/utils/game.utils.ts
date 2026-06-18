import {
  GameOverSummary,
  GamePhase,
  IncidentDisplay,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  PublicGameState,
  PublicPlayer,
  ServerIncidentReport,
  SoloWinner,
  Team,
  VoteEdge,
} from '../models/game-state.model';

export { MIN_PLAYERS_TO_START, MAX_PLAYERS };

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
    role: p.role,
    team: p.team,
  }));

  const playerCount = raw?.playerCount ?? players.length;

  return {
    roomId: raw?.roomId ?? '',
    phase: (raw?.phase ?? 'LOBBY') as GamePhase,
    phaseStartedAt: raw?.phaseStartedAt ?? Date.now(),
    players,
    dayNumber: raw?.dayNumber ?? 0,
    nightNumber: raw?.nightNumber ?? 0,
    maxPlayers: raw?.maxPlayers ?? MAX_PLAYERS,
    playerCount,
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

export function incidentsFromServerReport(
  report: ServerIncidentReport,
  state: PublicGameState | null,
): IncidentDisplay[] {
  const byId = new Map((state?.players ?? []).map((p) => [p.id, p]));
  return report.disconnected.map((id) => ({
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

export function winnerLabel(
  winner: Team | null | undefined,
  soloWinner?: SoloWinner | null,
  players?: PublicPlayer[],
): string {
  return buildGameOverSummary({
    roomId: '',
    phase: 'FIN',
    phaseStartedAt: 0,
    players: players ?? [],
    dayNumber: 0,
    nightNumber: 0,
    maxPlayers: MAX_PLAYERS,
    playerCount: players?.length ?? 0,
    votes: {},
    winner: winner ?? null,
    soloWinner: soloWinner ?? null,
  })?.headline ?? 'Partida terminada';
}

export function buildGameOverSummary(
  state: PublicGameState | null,
): GameOverSummary | null {
  if (!state) return null;

  if (state.soloWinner) {
    const name =
      state.players.find((p) => p.id === state.soloWinner!.playerId)?.name ??
      state.soloWinner.playerId;
    return {
      teamLabel: 'CAÓTICOS',
      headline: 'Victoria de los CAÓTICOS',
      winners: [{ playerName: name, role: state.soloWinner.role }],
    };
  }

  if (state.winner === 'system') {
    return {
      teamLabel: 'BLUE TEAM',
      headline: 'Victoria del BLUE TEAM',
      winners: state.players
        .filter((p) => p.team === 'system')
        .map((p) => ({ playerName: p.name, role: p.role ?? 'Desconocido' })),
    };
  }

  if (state.winner === 'black_hat') {
    return {
      teamLabel: 'RED TEAM',
      headline: 'Victoria del RED TEAM',
      winners: state.players
        .filter((p) => p.team === 'black_hat')
        .map((p) => ({ playerName: p.name, role: p.role ?? 'Desconocido' })),
    };
  }

  return null;
}

export function isNodeCritical(player: PublicPlayer): boolean {
  return !player.isAlive || !player.isConnected;
}
