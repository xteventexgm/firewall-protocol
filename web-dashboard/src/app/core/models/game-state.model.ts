export type GamePhase =
  | 'LOBBY'
  | 'REPARTO'
  | 'NOCHE'
  | 'DIA'
  | 'VOTACION'
  | 'VERIFICACION';

export interface PublicPlayer {
  id: string;
  name: string;
  isAlive: boolean;
  joinedAt: number;
}

export interface PublicGameState {
  roomId: string;
  phase: GamePhase;
  phaseStartedAt: number;
  players: PublicPlayer[];
  dayNumber: number;
  nightNumber: number;
  votes: Record<string, string[]>;
  logs: string[];
}

export interface VoteEdge {
  from: string;
  to: string;
}

export interface IncidentReport {
  playerId: string;
  playerName: string;
}

export const DASHBOARD_PLAYER_ID = '__dashboard__';
export const MIN_PLAYERS_TO_START = 5;
export const MAX_MOBILE_PLAYERS_WITH_HOST = 14;
