export type GamePhase =
  | 'LOBBY'
  | 'REPARTO'
  | 'NOCHE'
  | 'DIA'
  | 'VOTACION'
  | 'VERIFICACION'
  | 'FIN';

export interface PublicPlayer {
  id: string;
  name: string;
  isAlive: boolean;
  isConnected: boolean;
  silenced?: boolean;
  joinedAt?: number;
}

export interface PublicGameState {
  roomId: string;
  phase: GamePhase;
  phaseStartedAt: number;
  players: PublicPlayer[];
  dayNumber: number;
  nightNumber: number;
  votes: Record<string, string[]>;
  winner?: string | null;
  soloWinner?: { playerId: string; role: string; reason: string } | null;
}

export interface VoteEdge {
  from: string;
  to: string;
}

export interface IncidentReport {
  playerId: string;
  playerName: string;
}

export const MIN_PLAYERS_TO_START = 5;
export const MAX_PLAYERS = 15;
