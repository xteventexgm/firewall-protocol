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

/**
 * Reporte de amanecer tras resolver la noche.
 * `eliminatedPlayerIds` = jugadores eliminados esa noche (kills nocturnos).
 * `disconnected` es alias histórico del mismo array — NO son desconexiones de socket.
 */
export interface IncidentReport {
  roomId: RoomId;
  nightNumber: number;
  /** IDs eliminados durante la noche (consenso hacker, Pentester, infección madura, etc.). */
  eliminatedPlayerIds: PlayerId[];
  /**
   * @deprecated Usar `eliminatedPlayerIds`. Mantiene compatibilidad con clientes antiguos.
   * No representa jugadores con `isConnected: false`.
   */
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

/** Resolución completa de la noche (dashboard / depuración). */
export interface NightResolution {
  kills: PlayerId[];
  prevented: { actionId: string; reason: string }[];
  redirects: { actionId: string; from: string; to: string }[];
  logs: string[];
  privateResults: { playerId: string; payload: PrivateResultPayload }[];
  silenced: PlayerId[];
  honeypotDrags: { honeypotId: string; draggedId: string }[];
  infections: PlayerId[];
  cures: PlayerId[];
  infectionKills: PlayerId[];
}

/** Payload reducido de `nightResolved` para namespace `/game` (sin logs ni privateResults). */
export type PublicNightResolution = Omit<NightResolution, 'logs' | 'privateResults'>;

export function toPublicNightResolution(resolution: NightResolution): PublicNightResolution {
  const { logs: _logs, privateResults: _privateResults, ...publicResolution } = resolution;
  return publicResolution;
}

/** Estado de sala enviado a cada jugador vía `roomState` (filtrado por viewer). */
export interface PlayerRoomState {
  roomId: RoomId;
  phase: GamePhase;
  phaseStartedAt: number;
  maxPlayers: number;
  playerCount: number;
  players: Array<{
    id: PlayerId;
    name: string;
    isAlive: boolean;
    isConnected: boolean;
    role?: RoleId;
    team?: Team;
    metadata?: Record<string, unknown>;
    pendingActions?: PlayerAction[];
  }>;
  dayNumber: number;
  nightNumber: number;
  votes: Record<string, PlayerId[]>;
  logs: string[];
  winner: Team | null;
  soloWinner: SoloWinner | null;
  lastNightKills: PlayerId[];
}

export interface RoomCreatedPayload {
  roomId: RoomId;
  maxPlayers: number;
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
  roomState: (roomId: RoomId, state: PlayerRoomState) => void;
  phaseChanged: (roomId: RoomId, phase: GamePhase) => void;
  phaseTransition: (payload: PhaseTransition) => void;
  actionAccepted: (actionId: string) => void;
  privateResult: (roomId: RoomId, payload: PrivateResultPayload) => void;
  incidentReport: (report: IncidentReport) => void;
  publicState: (state: PublicGameState) => void;
  voteTrace: (trace: VoteTrace) => void;
  voteTied: (payload: VoteTiedPayload) => void;
  /** `/game`: payload reducido (`PublicNightResolution`). `/dashboard`: resolución completa. */
  nightResolved: (roomId: RoomId, resolution: NightResolution | PublicNightResolution) => void;
  playerReconnected: (roomId: RoomId, playerId: PlayerId) => void;
  playerDisconnected: (roomId: RoomId, playerId: PlayerId) => void;
  playerEliminated: (roomId: RoomId, playerId: PlayerId, reason: string) => void;
  gameOver: (roomId: RoomId, winner: Team | null, soloWinner?: SoloWinner | null) => void;
  error: (msg: string) => void;
}

/** Eventos exclusivos del namespace `/dashboard` (además de los compartidos). */
export interface DashboardServerToClientEvents {
  roomCreated: (payload: RoomCreatedPayload) => void;
}
