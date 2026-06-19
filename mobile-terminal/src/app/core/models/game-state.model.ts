export type GamePhase =
  | 'LOBBY'
  | 'REPARTO'
  | 'NOCHE'
  | 'DIA'
  | 'VOTACION'
  | 'VERIFICACION'
  | 'FIN';

/** Metadata propia visible en roomState (backend sanitizeMetadata isSelf). */
export interface PlayerRoleMeta {
  pentesterUsesLeft?: number;
  shieldCharges?: number;
  ransomwareCooldown?: number;
  isWormImmune?: boolean;
  assumedFromPlayerId?: string | null;
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
  | 'infection_warning';

export interface PrivateResultPayload {
  type: PrivateResultType;
  targetId?: string;
  result?: 'safe' | 'malicious';
  visitors?: string[];
  members?: string[];
  role?: string;
  team?: string;
  displayName?: string;
  description?: string;
  teamLabel?: string;
  nightAction?: string | null;
  nightActionHint?: string;
  infectionSource?: string;
  maturesAfterNight?: number;
  critical?: boolean;
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
  winner?: string | null;
  soloWinner?: { playerId: string; role: string; reason: string } | null;
  lastNightKills?: string[];
}

export interface IncidentReport {
  playerId: string;
  playerName: string;
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

export interface NightResolution {
  kills: string[];
  prevented: { actionId: string; reason: string }[];
  redirects: { actionId: string; from: string; to: string }[];
  logs: string[];
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
export const MAX_PLAYERS = 15;

/** Mismas proporciones que backend-server/src/utils/constants.ts */
export const PLAYERS_PER_BLACK_HAT = 3;
export const PLAYERS_PER_CHAOTIC_ROLE = 5;
