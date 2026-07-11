import {
  GameOverPayload,
  GameOverSummary,
  GamePhase,
  IncidentDisplay,
  NightResolution,
  PublicGameState,
  PublicPlayer,
  SocketIncidentReport,
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
    avatarUrl: p.avatarUrl ?? undefined,
    isAlive: p.isAlive !== false,
    isConnected: p.isConnected !== false,
    isReady: p.isReady,
    isBot: p.isBot === true,
    silenced: p.silenced === true,
    role: p.role ?? undefined,
    team: p.team ?? undefined,
  }));

  return {
    roomId: (raw?.roomId ?? '').toUpperCase(),
    phase: (raw?.phase ?? 'LOBBY') as GamePhase,
    phaseStartedAt: raw?.phaseStartedAt ?? Date.now(),
    gameStartedAt: raw?.gameStartedAt,
    phaseEndsAt: raw?.phaseEndsAt ?? null,
    players,
    dayNumber: raw?.dayNumber ?? 0,
    nightNumber: raw?.nightNumber ?? 0,
    maxPlayers: raw?.maxPlayers ?? players.length,
    playerCount: raw?.playerCount ?? players.length,
    votes: raw?.votes ?? {},
    winner: raw?.winner ?? null,
    soloWinner: raw?.soloWinner ?? null,
    publicLogs: raw?.publicLogs ?? [],
    chatMessages: raw?.chatMessages ?? [],
    nightProgress: raw?.nightProgress,
    phaseConfig: raw?.phaseConfig,
    gameStats: raw?.gameStats,
  };
}

export function getEliminatedIdsFromIncident(report: SocketIncidentReport): string[] {
  return report.eliminatedPlayerIds ?? report.disconnected ?? [];
}

export function incidentsFromServerReport(
  report: SocketIncidentReport,
  state: PublicGameState | null,
): IncidentDisplay[] {
  const ids = getEliminatedIdsFromIncident(report);
  const byId = new Map((state?.players ?? []).map((p) => [p.id, p]));
  return ids.map((id) => {
    const player = byId.get(id);
    return {
      playerId: id,
      playerName: player?.name ?? id,
      role: player?.role,
    };
  });
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

export function countSkipVotes(votes: Record<string, string[]>): number {
  return (votes['skip'] ?? votes['null'] ?? []).length;
}

export function skipVoterIds(votes: Record<string, string[]>): string[] {
  return votes['skip'] ?? votes['null'] ?? [];
}

export function playerNameById(state: PublicGameState | null, id: string): string {
  return state?.players.find((p) => p.id === id)?.name ?? id;
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
    infection: 'infección madura',
    night_kill: 'ataque nocturno',
  };
  return labels[reason] ?? reason;
}

export function formatVoteTiedMessage(payload: {
  reason: 'tie' | 'no_votes';
  candidates: string[];
  skipVotes: number;
}): string {
  if (payload.reason === 'no_votes') {
    const skip =
      payload.skipVotes > 0 ? ` (${payload.skipVotes} abstención(es))` : '';
    return `Sin votos de eliminación${skip} — la red pasa a operación nocturna.`;
  }
  const names = payload.candidates.length
    ? payload.candidates.join(', ')
    : 'varios nodos';
  const skip = payload.skipVotes ? ` (${payload.skipVotes} abstención(es))` : '';
  return `La votación terminó en empate entre ${names}${skip}. Nadie fue linchado — pasa a NOCHE.`;
}

export function formatNightResolutionToast(resolution: NightResolution): string | null {
  const parts: string[] = [];
  if (resolution.kills?.length) parts.push(`${resolution.kills.length} caída(s) nocturna(s)`);
  if (resolution.silenced?.length) parts.push(`${resolution.silenced.length} silenciado(s)`);
  if (resolution.infections?.length) parts.push(`${resolution.infections.length} infectado(s)`);
  if (resolution.cures?.length) parts.push(`${resolution.cures.length} curado(s)`);
  if (resolution.infectionKills?.length) {
    parts.push(`${resolution.infectionKills.length} baja(s) por infección`);
  }
  if (resolution.honeypotDrags?.length) {
    parts.push(`${resolution.honeypotDrags.length} arrastre(s) honeypot`);
  }
  return parts.length ? `Noche resuelta: ${parts.join(', ')}` : null;
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

export function roleTeamHint(role?: string): Team | null {
  if (!role) return null;
  const blackHat = ['DDoS Operator', 'Rootkit', 'Ransomware', 'Spyware', 'Phisher'];
  const chaotic = ['Troll', 'Gusano', 'Minero de Cripto', 'Zero-Day'];
  const system = [
    'SysAdmin',
    'Analista SOC',
    'Antivirus',
    'Pentester',
    'Honeypot',
    'Deep Freeze',
    'Enrutador BGP',
  ];
  if (blackHat.includes(role)) return 'black_hat';
  if (chaotic.includes(role)) return 'chaotic';
  if (system.includes(role)) return 'system';
  return null;
}
