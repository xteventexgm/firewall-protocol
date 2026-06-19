export type GamePhase =
  | 'LOBBY'
  | 'REPARTO'
  | 'NOCHE'
  | 'DIA'
  | 'VOTACION'
  | 'VERIFICACION'
  | 'FIN';

export type Team = 'system' | 'black_hat' | 'chaotic';

export type ScanResult = 'safe' | 'suspicious' | 'malicious';

export interface PublicPlayer {
  id: string;
  name: string;
  isAlive: boolean;
  isConnected: boolean;
  silenced?: boolean;
  role?: string;
}

export interface SoloWinner {
  playerId: string;
  role: string;
  reason: string;
}

export interface PublicGameState {
  roomId: string;
  phase: GamePhase;
  phaseStartedAt: number;
  players: PublicPlayer[];
  dayNumber: number;
  nightNumber: number;
  maxPlayers: number;
  playerCount: number;
  votes: Record<string, string[]>;
  winner: Team | null;
  soloWinner: SoloWinner | null;
}

export interface VoteEdge {
  from: string;
  to: string;
}

/** Reporte de amanecer — `disconnected` es alias legacy de `eliminatedPlayerIds`. */
export interface SocketIncidentReport {
  roomId: string;
  nightNumber: number;
  eliminatedPlayerIds: string[];
  /** @deprecated alias de eliminatedPlayerIds — no son desconexiones socket */
  disconnected?: string[];
}

/** @deprecated usar SocketIncidentReport */
export type ServerIncidentReport = SocketIncidentReport;

export interface IncidentDisplay {
  playerId: string;
  playerName: string;
  role?: string;
}

export interface PhaseTransition {
  roomId: string;
  from: GamePhase;
  to: GamePhase;
  at: number;
}

export interface VoteTrace {
  roomId: string;
  voter: string;
  target: string | null;
  timestamp: number;
}

export interface VoteTiedPayload {
  roomId: string;
  voteCount: number;
  candidates: string[];
  skipVotes: number;
  reason: 'tie' | 'no_votes';
}

export interface GameOverPayload {
  roomId: string;
  winner: Team | null;
  soloWinner?: SoloWinner | null;
}

export interface GameOverSummary {
  headline: string;
  message?: string;
  winners: { playerName: string; role: string }[];
  reveals?: GameOverReveal[];
  outcome?: 'win' | 'loss' | 'neutral';
}

export interface GameOverReveal {
  title: string;
  items: string[];
}

export interface PrivateResultPayload {
  type:
    | 'scan'
    | 'spy'
    | 'hacker_team'
    | 'role_assigned'
    | 'infected'
    | 'cured'
    | 'infection_warning';
  targetId?: string;
  result?: ScanResult;
  visitors?: string[];
  visitorActivities?: { playerId: string; activity: string }[];
  members?: string[];
  role?: string;
  team?: Team;
  displayName?: string;
  description?: string;
  teamLabel?: string;
  nightAction?: string | null;
  nightActionHint?: string;
  infectionSource?: string;
  maturesAfterNight?: number;
  critical?: boolean;
}

/** Resolución completa de noche (namespace /dashboard). */
export interface NightResolution {
  kills: string[];
  prevented: { actionId: string; reason: string }[];
  redirects: { actionId: string; from: string; to: string }[];
  logs: string[];
  privateResults: { playerId: string; payload: PrivateResultPayload }[];
  silenced: string[];
  honeypotDrags: { honeypotId: string; draggedId: string }[];
  infections: string[];
  cures: string[];
  infectionKills: string[];
}

/** Payload reducido para móvil (referencia; dashboard usa NightResolution completo). */
export type PublicNightResolution = Omit<NightResolution, 'logs' | 'privateResults'>;

export interface RoomCreatedPayload {
  roomId: string;
  maxPlayers: number;
}

export interface SavedRoom {
  roomId: string;
  maxPlayers: number;
  savedAt: number;
}

export const MIN_PLAYERS_TO_START = 5;
export const MAX_PLAYERS = 15;
