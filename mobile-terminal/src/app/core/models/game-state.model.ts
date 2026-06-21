export type GamePhase =
  | 'LOBBY'
  | 'REPARTO'
  | 'NOCHE'
  | 'DIA'
  | 'VOTACION'
  | 'VERIFICACION'
  | 'FIN';

export type ScanResult = 'safe' | 'suspicious' | 'malicious';

/** Metadata propia visible en roomState (backend sanitizeMetadata isSelf). */
export interface PlayerRoleMeta {
  pentesterUsesLeft?: number;
  shieldCharges?: number;
  ransomwareCooldown?: number;
  isWormImmune?: boolean;
  assumedFromPlayerId?: string | null;
  emergencyPatchUsed?: boolean;
}

export interface PublicLogEntry {
  id: string;
  timestamp: number;
  message: string;
  severity: string;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  channel: string;
  timestamp: number;
}

export interface NightProgress {
  acted: number;
  total: number;
}

export interface MinigameChallenge {
  token: string;
  type: string;
  objective: string;
  prompt: string;
  context?: string;
  options?: string[];
  successHint: string;
  failHint: string;
  expiresAt: number;
}

export interface GameStatsEntry {
  label: string;
  value: string;
  detail?: string;
}

export interface RoomPlayer {
  id: string;
  name: string;
  isAlive: boolean;
  isConnected: boolean;
  silenced?: boolean;
  infected?: boolean;
  infectionMaturesAfterNight?: number;
  joinedAt?: number;
  role?: string;
  team?: string;
  meta?: PlayerRoleMeta;
}

export type PrivateResultType =
  | 'scan'
  | 'spy'
  | 'hacker_team'
  | 'role_assigned'
  | 'infected'
  | 'cured'
  | 'infection_warning'
  | 'miner_update';

export interface VisitorActivity {
  playerId: string;
  activity: string;
}

export interface PrivateResultPayload {
  type: PrivateResultType;
  targetId?: string;
  result?: ScanResult;
  visitors?: string[];
  visitorActivities?: VisitorActivity[];
  members?: string[];
  role?: string;
  team?: string;
  displayName?: string;
  description?: string;
  teamLabel?: string;
  nightAction?: string | null;
  nightActionHint?: string;
  victoryHint?: string;
  infectionSource?: string;
  maturesAfterNight?: number;
  critical?: boolean;
  shieldCharges?: number;
  minedTargetId?: string;
  bribedTargetId?: string;
  bribeKilled?: boolean;
}

export interface PlayerRoomState {
  roomId: string;
  phase: GamePhase;
  phaseStartedAt: number;
  players: RoomPlayer[];
  dayNumber: number;
  nightNumber: number;
  maxPlayers: number;
  playerCount: number;
  votes: Record<string, string[]>;
  logs: string[];
  publicLogs?: PublicLogEntry[];
  chatMessages?: ChatMessage[];
  nightProgress?: NightProgress;
  gameStats?: GameStatsEntry[];
  winner?: string | null;
  soloWinner?: { playerId: string; role: string; reason: string } | null;
  lastNightKills?: string[];
}

/** Payload socket `incidentReport` (backend events.types.ts). */
export interface SocketIncidentReport {
  roomId: string;
  nightNumber: number;
  eliminatedPlayerIds: string[];
  /** @deprecated alias de eliminatedPlayerIds — no son desconexiones socket */
  disconnected?: string[];
}

export interface VoteTiedPayload {
  roomId: string;
  voteCount: number;
  candidates: string[];
  skipVotes: number;
  reason: 'tie' | 'no_votes';
}

export interface PhaseTransition {
  roomId: string;
  from: GamePhase;
  to: GamePhase;
  at: number;
}

/** Payload reducido de nightResolved en namespace /game (sin logs ni privateResults). */
export interface PublicNightResolution {
  kills: string[];
  prevented: { actionId: string; reason: string }[];
  redirects: { actionId: string; from: string; to: string }[];
  silenced: string[];
  infections?: string[];
  cures?: string[];
  infectionKills?: string[];
  honeypotDrags?: { honeypotId: string; draggedId: string }[];
}

export interface VoteTrace {
  roomId: string;
  voter: string;
  target: string | null;
  timestamp: number;
}

export interface GameOverPayload {
  roomId: string;
  winner: string | null;
  soloWinner?: { playerId: string; role: string; reason: string } | null;
}

export interface PlayerView {
  name: string;
  role: string;
  roleId?: string;
  team?: string;
  teamLabel?: string;
  roleDescription?: string;
  nightActionHint?: string;
  isDead: boolean;
  silenced?: boolean;
  isConnected?: boolean;
}

export interface TargetOption {
  id: string;
  name: string;
  isAlive?: boolean;
  isConnected?: boolean;
}

export const MIN_PLAYERS_TO_START = 5;
export const MAX_PLAYERS = 16;
export const PLAYERS_PER_CHAOTIC_ROLE = 5;
