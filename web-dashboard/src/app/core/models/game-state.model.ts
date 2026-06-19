export type GamePhase =
  | 'LOBBY'
  | 'REPARTO'
  | 'NOCHE'
  | 'DIA'
  | 'VOTACION'
  | 'VERIFICACION'
  | 'FIN';

export type Team = 'system' | 'black_hat' | 'chaotic';

export interface PublicPlayer {
  id: string;
  name: string;
  isAlive: boolean;
  isConnected: boolean;
  silenced?: boolean;
  joinedAt?: number;
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

export interface ServerIncidentReport {
  roomId: string;
  nightNumber: number;
  disconnected: string[];
}

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
  winners: { playerName: string; role: string }[];
}

export interface SavedRoom {
  roomId: string;
  maxPlayers: number;
  savedAt: number;
}

export const MIN_PLAYERS_TO_START = 5;
export const MAX_PLAYERS = 15;
