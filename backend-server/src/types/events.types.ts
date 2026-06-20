/**
 * Contrato Socket.io y tipos de dominio del juego.
 *
 * Referencia compartida con mobile-terminal y web-dashboard.
 * Ver también `../SOCKET_CONTRACT.md` en la raíz del monorepo.
 *
 * Secciones principales:
 * - Fases (`GamePhase`), acciones (`PlayerAction`), votos
 * - Payloads S→C: `PrivateResultPayload`, `IncidentReport`, `NightResolution`
 * - Interfaces de eventos tipados para socket.io (documentación)
 */
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
  /** Nodo con infección activa (visible en dashboard). */
  infected?: boolean;
  /** Visible en dashboard cuando el jugador está eliminado o la partida terminó. */
  role?: RoleId;
}

/** Resumen de amenaza al iniciar partida (solo dashboard / narrativa TV). */
export interface SessionThreatBrief {
  hackerCount: number;
  /** Caóticos — etiqueta diegética: "intrusos". */
  intruderCount: number;
  systemCount: number;
  nodeCount: number;
}

export type ChatChannel = 'public' | 'dead' | 'hacker';

export interface ChatMessage {
  id: string;
  playerId: PlayerId;
  playerName: string;
  text: string;
  channel: ChatChannel;
  timestamp: number;
  phase: GamePhase;
}

export interface PublicLogEntry {
  id: string;
  timestamp: number;
  nightNumber?: number;
  dayNumber?: number;
  message: string;
  severity: 'info' | 'warn' | 'critical' | 'success';
}

export interface PhaseConfig {
  autoAdvance: boolean;
  nightDurationMs: number;
  dayDurationMs: number;
  voteDurationMs: number;
}

export interface NightProgress {
  acted: number;
  total: number;
}

export interface GameStats {
  scansPerformed: number;
  killsPrevented: number;
  infectionsApplied: number;
  votesCast: number;
  honeypotDrags: number;
  playerActions: Record<PlayerId, number>;
  mvpPlayerId: PlayerId | null;
  mvpReason: string | null;
}

export interface GameStatsEntry {
  label: string;
  value: string;
  detail?: string;
}

export interface MinigameChallengePayload {
  token: string;
  type: string;
  prompt: string;
  options?: string[];
  expiresAt: number;
}

export interface PublicGameState {
  roomId: RoomId;
  phase: GamePhase;
  phaseStartedAt: number;
  phaseEndsAt?: number | null;
  dayNumber: number;
  nightNumber: number;
  maxPlayers: number;
  playerCount: number;
  players: PublicPlayerState[];
  votes: Record<string, PlayerId[]>;
  winner: Team | null;
  soloWinner: SoloWinner | null;
  publicLogs?: PublicLogEntry[];
  chatMessages?: ChatMessage[];
  nightProgress?: NightProgress;
  phaseConfig?: PhaseConfig;
  gameStats?: GameStatsEntry[];
  sessionThreatBrief?: SessionThreatBrief;
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

export type ScanResult = 'safe' | 'suspicious' | 'malicious';

export interface PrivateResultPayload {
  type: 'scan' | 'spy' | 'hacker_team' | 'role_assigned' | 'infected' | 'cured' | 'infection_warning' | 'miner_update';
  targetId?: PlayerId;
  result?: ScanResult;
  visitors?: PlayerId[];
  /** Actividad observada por Spyware (tipo de acción, sin revelar rol). */
  visitorActivities?: { playerId: PlayerId; activity: string }[];
  members?: PlayerId[];
  role?: RoleId;
  team?: Team;
  displayName?: string;
  description?: string;
  teamLabel?: string;
  nightAction?: string | null;
  nightActionHint?: string;
  victoryHint?: string;
  infectionSource?: string;
  maturesAfterNight?: number;
  /** Infección madura esta noche — el nodo caerá si no fue curado. */
  critical?: boolean;
  /** Minero: escudos tras mine_crypto o crypto_bribe. */
  shieldCharges?: number;
  minedTargetId?: PlayerId;
  bribedTargetId?: PlayerId;
  bribeKilled?: boolean;
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
  phaseEndsAt?: number | null;
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
  }>;
  dayNumber: number;
  nightNumber: number;
  votes: Record<string, PlayerId[]>;
  logs: string[];
  publicLogs?: PublicLogEntry[];
  chatMessages?: ChatMessage[];
  nightProgress?: NightProgress;
  phaseConfig?: PhaseConfig;
  winner: Team | null;
  soloWinner: SoloWinner | null;
  lastNightKills: PlayerId[];
  gameStats?: GameStatsEntry[];
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
  submitChat: (roomId: RoomId, payload: { playerId: PlayerId; text: string; channel?: ChatChannel }) => void;
  submitDayAction: (roomId: RoomId, payload: { actor: PlayerId; type: string; target?: PlayerId }) => void;
  requestMinigame: (roomId: RoomId, playerId: PlayerId) => void;
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
  setPhaseConfig: (roomId: RoomId, config: Partial<PhaseConfig>) => void;
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
  playerReconnected: (roomId: RoomId, playerId: PlayerId, playerName?: string) => void;
  playerDisconnected: (roomId: RoomId, playerId: PlayerId, playerName?: string) => void;
  /** Host eliminó la sala desde el dashboard. */
  lobbyClosed: (roomId: RoomId, payload?: { reason?: string }) => void;
  playerEliminated: (roomId: RoomId, playerId: PlayerId, reason: string) => void;
  gameOver: (roomId: RoomId, winner: Team | null, soloWinner?: SoloWinner | null) => void;
  chatMessage: (roomId: RoomId, message: ChatMessage) => void;
  publicLog: (roomId: RoomId, entry: PublicLogEntry) => void;
  publicLogsBatch: (roomId: RoomId, entries: PublicLogEntry[]) => void;
  minigameChallenge: (roomId: RoomId, challenge: MinigameChallengePayload) => void;
  nightProgress: (roomId: RoomId, progress: NightProgress) => void;
  phaseConfigChanged: (roomId: RoomId, config: PhaseConfig) => void;
  gameStats: (roomId: RoomId, stats: GameStatsEntry[]) => void;
  error: (msg: string) => void;
}

/** Eventos exclusivos del namespace `/dashboard` (además de los compartidos). */
export interface DashboardServerToClientEvents {
  roomCreated: (payload: RoomCreatedPayload) => void;
  playerConnected: (roomId: RoomId, playerId: PlayerId, playerName?: string) => void;
}
