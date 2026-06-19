import { RoleId, Team } from './roles.types';

export enum GamePhase {
  LOBBY = 'LOBBY',
  REPARTO = 'REPARTO',
  NOCHE = 'NOCHE',
  DIA = 'DIA',
  VOTACION = 'VOTACION',
  VERIFICACION = 'VERIFICACION',
  FIN = 'FIN',
}

export type PlayerId = string;
export type RoomId = string;

export interface PlayerAction {
  id: string;
  actor: PlayerId;
  role?: RoleId;
  type: string;
  target?: PlayerId | null;
  timestamp: number;
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

export interface IncidentReport {
  roomId: RoomId;
  nightNumber: number;
  disconnected: PlayerId[];
}

export interface PublicPlayerState {
  id: PlayerId;
  name: string;
  isAlive: boolean;
  isConnected: boolean;
  silenced?: boolean;
  /** Visible en dashboard cuando el jugador está eliminado o la partida terminó. */
  role?: RoleId;
}

export interface PublicGameState {
  roomId: RoomId;
  phase: GamePhase;
  phaseStartedAt: number;
  dayNumber: number;
  nightNumber: number;
  maxPlayers: number;
  playerCount: number;
  players: PublicPlayerState[];
  votes: Record<string, PlayerId[]>;
  winner: Team | null;
  soloWinner: SoloWinner | null;
}

export interface VoteTiedPayload {
  roomId: RoomId;
  voteCount: number;
  candidates: PlayerId[];
  /** Votos en blanco / skip (target null). */
  skipVotes: number;
  reason: 'tie' | 'no_votes';
}

export interface SoloWinner {
  playerId: PlayerId;
  role: RoleId;
  reason: string;
}

export type ScanResult = 'safe' | 'malicious';

export interface PrivateResultPayload {
  type: 'scan' | 'spy' | 'hacker_team' | 'role_assigned' | 'infected' | 'cured' | 'infection_warning';
  targetId?: PlayerId;
  result?: ScanResult;
  visitors?: PlayerId[];
  members?: PlayerId[];
  role?: RoleId;
  team?: Team;
  displayName?: string;
  description?: string;
  teamLabel?: string;
  nightAction?: string | null;
  nightActionHint?: string;
  infectionSource?: string;
  maturesAfterNight?: number;
  /** Infección madura esta noche — el nodo caerá si no fue curado. */
  critical?: boolean;
}

export interface VoteTrace {
  roomId: RoomId;
  voter: PlayerId;
  target: PlayerId | null;
  timestamp: number;
}

export interface PhaseTransition {
  roomId: RoomId;
  from: GamePhase;
  to: GamePhase;
  at: number;
}

export interface ClientToServerEvents {
  joinRoom: (roomId: RoomId, playerId: PlayerId, name?: string) => void;
  leaveRoom: (roomId: RoomId, playerId: PlayerId) => void;
  playerAction: (roomId: RoomId, action: PlayerAction) => void;
  submitVote: (roomId: RoomId, vote: VoteRecord) => void;
  startGame: (roomId: RoomId) => void;
  advancePhase: (roomId: RoomId) => void;
  createRoom: (roomId: RoomId) => void;
}

export interface DashboardClientEvents {
  joinDashboard: (roomId: RoomId) => void;
  leaveDashboard: (roomId: RoomId) => void;
  createRoom: (roomId: RoomId, maxPlayers: number) => void;
  startGame: (roomId: RoomId) => void;
  advancePhase: (roomId: RoomId) => void;
}

export interface ServerToClientEvents {
  roomState: (roomId: RoomId, state: any) => void;
  phaseChanged: (roomId: RoomId, phase: GamePhase) => void;
  phaseTransition: (payload: PhaseTransition) => void;
  actionAccepted: (actionId: string) => void;
  privateResult: (roomId: RoomId, payload: PrivateResultPayload) => void;
  incidentReport: (report: IncidentReport) => void;
  publicState: (state: PublicGameState) => void;
  voteTrace: (trace: VoteTrace) => void;
  voteTied: (payload: VoteTiedPayload) => void;
  nightResolved: (roomId: RoomId, resolution: any) => void;
  playerReconnected: (roomId: RoomId, playerId: PlayerId) => void;
  playerDisconnected: (roomId: RoomId, playerId: PlayerId) => void;
  playerEliminated: (roomId: RoomId, playerId: PlayerId, reason: string) => void;
  gameOver: (roomId: RoomId, winner: Team | null, soloWinner?: SoloWinner | null) => void;
  error: (msg: string) => void;
}
