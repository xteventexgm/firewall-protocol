import { RoleId, Team } from './roles.types';

export enum GamePhase {
  LOBBY = 'LOBBY',
  REPARTO = 'REPARTO',
  NOCHE = 'NOCHE',
  DIA = 'DIA',
  VOTACION = 'VOTACION',
  VERIFICACION = 'VERIFICACION',
}

export type PlayerId = string;
export type RoomId = string;

export interface PlayerAction {
  id: string; // unique action id
  actor: PlayerId;
  role?: RoleId; // role that performed the action (if relevant)
  type: string; // e.g., 'attack', 'protect', 'scan', 'redirect', 'vote'
  target?: PlayerId | null;
  timestamp: number;
  // explicit priority for deterministic resolution; if omitted, engine uses role priority
  priority?: number;
  meta?: Record<string, any>;
}

export interface VoteRecord {
  voter: PlayerId;
  target: PlayerId | null;
}

export interface NightActionBatch {
  roomId: RoomId;
  phase: GamePhase;
  actions: PlayerAction[];
}

// Socket.io event contracts (minimal)
export interface ClientToServerEvents {
  joinRoom: (roomId: RoomId, playerId: PlayerId) => void;
  leaveRoom: (roomId: RoomId, playerId: PlayerId) => void;
  playerAction: (roomId: RoomId, action: PlayerAction) => void;
  submitVote: (roomId: RoomId, vote: VoteRecord) => void;
}

export interface ServerToClientEvents {
  roomState: (roomId: RoomId, state: any) => void;
  phaseChanged: (roomId: RoomId, phase: GamePhase) => void;
  actionAccepted: (actionId: string) => void;
  error: (msg: string) => void;
}
