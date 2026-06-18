import {
  GamePhase,
  IncidentReport,
  PlayerRoomState,
  RoomPlayer,
} from '../models/game-state.model';

export function sanitizeRoomState(raw: any): PlayerRoomState {
  const dayNumber = raw?.dayNumber ?? 0;
  const players: RoomPlayer[] = (raw?.players ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    isAlive: p.isAlive !== false,
    isConnected: p.isConnected !== false,
    silenced: isPlayerSilenced(p, dayNumber),
    joinedAt: p.joinedAt ?? Date.now(),
  }));

  return {
    roomId: raw?.roomId ?? '',
    phase: (raw?.phase ?? 'LOBBY') as GamePhase,
    phaseStartedAt: raw?.phaseStartedAt ?? Date.now(),
    players,
    dayNumber,
    nightNumber: raw?.nightNumber ?? 0,
    maxPlayers: raw?.maxPlayers ?? 15,
    playerCount: raw?.playerCount ?? players.length,
    votes: raw?.votes ?? {},
    logs: raw?.logs ?? [],
    winner: raw?.winner ?? null,
    soloWinner: raw?.soloWinner ?? null,
    lastNightKills: raw?.lastNightKills ?? [],
  };
}

export function isPlayerSilenced(player: any, dayNumber: number): boolean {
  const untilDay = player?.metadata?.silencedUntilDay;
  if (untilDay == null) return false;
  return untilDay >= dayNumber;
}

export function incidentsFromServerReport(
  disconnected: string[],
  state: PlayerRoomState | null,
): IncidentReport[] {
  const byId = new Map((state?.players ?? []).map((p) => [p.id, p]));
  return disconnected.map((id) => ({
    playerId: id,
    playerName: byId.get(id)?.name ?? id,
  }));
}

export function phaseLabel(phase: GamePhase | 'ELIMINATED'): string {
  const labels: Record<string, string> = {
    LOBBY: 'EN ESPERA',
    REPARTO: 'REPARTO DE ROLES',
    NOCHE: 'OPERACIÓN NOCTURNA',
    DIA: 'AUDITORÍA DIURNA',
    VOTACION: 'VOTACIÓN PÚBLICA',
    VERIFICACION: 'VERIFICACIÓN',
    FIN: 'PARTIDA TERMINADA',
    ELIMINATED: 'SISTEMA CAÍDO',
  };
  return labels[phase] ?? phase;
}

export function isNodeCritical(player: RoomPlayer): boolean {
  return !player.isAlive || !player.isConnected;
}

export function translateEliminationReason(reason: string): string {
  const labels: Record<string, string> = {
    vote: 'votación',
    honeypot_drag: 'arrastre honeypot',
  };
  return labels[reason] ?? reason;
}

export function winnerLabel(winner: string | null | undefined): string {
  const labels: Record<string, string> = {
    system: 'El SISTEMA ha restaurado la red',
    black_hat: 'BLACK HAT ha comprometido la infraestructura',
    chaotic: 'El caos ha prevalecido',
  };
  return winner ? (labels[winner] ?? `Ganador: ${winner}`) : 'Partida terminada';
}

export function winnerTeamName(winner: string | null | undefined): string {
  const labels: Record<string, string> = {
    system: 'SISTEMA',
    black_hat: 'BLACK HAT',
    chaotic: 'CAÓTICO',
  };
  return winner ? (labels[winner] ?? winner.toUpperCase()) : '—';
}

export function teamLabelFromKey(team: string | undefined): string {
  const labels: Record<string, string> = {
    system: 'Equipo Sistema',
    black_hat: 'Equipo Black Hat',
    chaotic: 'Equipo Caótico',
  };
  return team ? (labels[team] ?? team) : '';
}
