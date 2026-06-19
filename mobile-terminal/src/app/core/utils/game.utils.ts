import {
  GamePhase,
  PlayerRoleMeta,
  PlayerRoomState,
  RoomPlayer,
  SocketIncidentReport,
} from '../models/game-state.model';

function extractRoleMeta(metadata: any): PlayerRoleMeta | undefined {
  if (!metadata) return undefined;
  const meta: PlayerRoleMeta = {};
  if (metadata.pentesterUsesLeft != null) meta.pentesterUsesLeft = metadata.pentesterUsesLeft;
  if (metadata.shieldCharges != null) meta.shieldCharges = metadata.shieldCharges;
  if (metadata.ransomwareCooldown != null) meta.ransomwareCooldown = metadata.ransomwareCooldown;
  if (metadata.isWormImmune) meta.isWormImmune = true;
  if (metadata.assumedFromPlayerId) meta.assumedFromPlayerId = metadata.assumedFromPlayerId;
  return Object.keys(meta).length ? meta : undefined;
}

export function sanitizeRoomState(raw: any): PlayerRoomState {
  const dayNumber = raw?.dayNumber ?? 0;
  const players: RoomPlayer[] = (raw?.players ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    isAlive: p.isAlive !== false,
    isConnected: p.isConnected !== false,
    silenced: isPlayerSilenced(p, dayNumber),
    infected: !!p.metadata?.infection,
    infectionMaturesAfterNight: p.metadata?.infection?.maturesAfterNight,
    joinedAt: p.joinedAt ?? Date.now(),
    role: p.role,
    team: p.team,
    meta: extractRoleMeta(p.metadata),
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

export function infectionSourceLabel(source: string | undefined): string {
  if (source === 'worm') return 'Gusano';
  return source ?? 'origen desconocido';
}

export function getEliminatedIdsFromIncident(report: SocketIncidentReport): string[] {
  return report.eliminatedPlayerIds ?? report.disconnected ?? [];
}

export function incidentsFromServerReport(
  report: SocketIncidentReport,
  state: PlayerRoomState | null,
): { playerId: string; playerName: string }[] {
  const byId = new Map((state?.players ?? []).map((p) => [p.id, p]));
  return getEliminatedIdsFromIncident(report).map((id) => ({
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
    vote: 'votación pública',
    honeypot_drag: 'arrastre de honeypot',
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

export function deadPlayerRoleLabel(player: RoomPlayer, phase: GamePhase | 'ELIMINATED'): string | null {
  if (phase !== 'FIN' || player.isAlive || !player.role) return null;
  return player.role;
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
