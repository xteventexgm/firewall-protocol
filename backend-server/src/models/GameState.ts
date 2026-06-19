/**
 * Estado central de una partida (sala).
 *
 * Responsabilidades:
 * - Persistencia (`toPlain` / `fromObject`)
 * - Vistas filtradas: `toPlainForPlayer` (móvil), `toPublicState` (dashboard)
 * - Cola de acciones nocturnas (`actionQueue`), votos, contadores día/noche
 * - Redirección Phisher en votación diurna (`resolvePhisherRedirect`)
 *
 * La orquestación de fases y eventos socket está en `game/Room.ts`.
 */
import { GamePhase, PlayerAction, PublicGameState, SoloWinner } from '../types';
import { Team } from '../types/roles.types';
import { Player, PlayerProfile } from './PlayerProfile';
import { isSilenced, getMeta } from '../game/playerMetadata';
import { MAX_PLAYERS } from '../utils/constants';

export interface GameState {
  roomId: string;
  phase: GamePhase;
  phaseStartedAt: number;
  maxPlayers: number;
  players: PlayerProfile[];
  dayNumber: number;
  nightNumber: number;
  /** Acciones nocturnas pendientes de resolver al avanzar desde NOCHE. */
  actionQueue: PlayerAction[];
  votes: Record<string, string[]>;
  logs: string[];
  winner?: Team | null;
  soloWinner?: SoloWinner | null;
  /** IDs eliminados en la última noche resuelta (también en incidentReport). */
  lastNightKills: string[];
  /** Jugadores al iniciar partida; fija escalado de balance y límite de días. */
  initialPlayerCount?: number;
}

/** Modelo mutable del estado de sala; una instancia por `Room`. */
export class GameStateModel implements GameState {
  roomId: string;
  phase: GamePhase = GamePhase.LOBBY;
  phaseStartedAt: number = Date.now();
  maxPlayers: number = MAX_PLAYERS;
  players: Player[] = [];
  dayNumber = 0;
  nightNumber = 0;
  actionQueue: PlayerAction[] = [];
  votes: Record<string, string[]> = {};
  logs: string[] = [];
  winner: Team | null = null;
  soloWinner: SoloWinner | null = null;
  lastNightKills: string[] = [];
  initialPlayerCount = 0;

  constructor(roomId: string) {
    this.roomId = roomId;
  }

  /** Rehidrata estado desde JSON tras reinicio del servidor. Jugadores quedan desconectados hasta reconnect. */
  static fromObject(obj: any) {
    const s = new GameStateModel(obj.roomId || '');
    s.phase = obj.phase;
    s.phaseStartedAt = obj.phaseStartedAt || Date.now();
    s.maxPlayers = obj.maxPlayers ?? MAX_PLAYERS;
    s.dayNumber = obj.dayNumber || 0;
    s.nightNumber = obj.nightNumber || 0;
    s.actionQueue = obj.actionQueue || [];
    s.votes = obj.votes || {};
    s.logs = obj.logs || [];
    s.winner = obj.winner ?? null;
    s.soloWinner = obj.soloWinner ?? null;
    s.lastNightKills = obj.lastNightKills || [];
    s.initialPlayerCount = obj.initialPlayerCount ?? (obj.players?.length ?? 0);
    s.players = (obj.players || []).map((p: any) => {
      const pl = new Player(p.id, p.name, p.socketId);
      pl.role = p.role;
      pl.team = p.team;
      pl.isAlive = p.isAlive !== false;
      pl.isConnected = false;
      pl.joinedAt = p.joinedAt || Date.now();
      pl.metadata = p.metadata || {};
      return pl;
    });
    return s;
  }

  /** Snapshot completo para disco (`database.save`). */
  toPlain() {
    return {
      roomId: this.roomId,
      phase: this.phase,
      phaseStartedAt: this.phaseStartedAt,
      maxPlayers: this.maxPlayers,
      players: this.players.map(p => this.playerToPlain(p)),
      dayNumber: this.dayNumber,
      nightNumber: this.nightNumber,
      actionQueue: this.actionQueue,
      votes: this.votes,
      logs: this.logs,
      winner: this.winner,
      soloWinner: this.soloWinner,
      lastNightKills: this.lastNightKills,
      initialPlayerCount: this.initialPlayerCount,
    };
  }

  /**
   * Estado enviado a un jugador móvil (`roomState`).
   * Oculta rol/equipo ajenos; sanitiza metadata según viewer.
   */
  toPlainForPlayer(viewerId: string) {
    // Durante la partida oculta rol/team de otros vivos y eliminados. El dashboard (publicState) sí revela rol de eliminados.
    const hideRoles = this.phase !== GamePhase.LOBBY && this.phase !== GamePhase.REPARTO && this.phase !== GamePhase.FIN;
    return {
      roomId: this.roomId,
      phase: this.phase,
      phaseStartedAt: this.phaseStartedAt,
      maxPlayers: this.maxPlayers,
      playerCount: this.players.length,
      players: this.players.map(p => {
        const plain = this.playerToPlain(p);
        if (hideRoles && p.id !== viewerId) {
          return { ...plain, role: undefined, team: undefined, metadata: this.sanitizeMetadata(plain.metadata) };
        }
        if (hideRoles && p.id === viewerId) {
          return { ...plain, metadata: this.sanitizeMetadata(plain.metadata, true) };
        }
        return plain;
      }),
      dayNumber: this.dayNumber,
      nightNumber: this.nightNumber,
      votes: this.votes,
      logs: this.logs,
      winner: this.winner,
      soloWinner: this.soloWinner,
      lastNightKills: this.lastNightKills,
    };
  }

  /**
   * Topología pública para dashboard (`publicState`).
   * Revela rol de jugadores eliminados; no expone metadata secreta.
   */
  toPublicState(): PublicGameState {
    return {
      roomId: this.roomId,
      phase: this.phase,
      phaseStartedAt: this.phaseStartedAt,
      dayNumber: this.dayNumber,
      nightNumber: this.nightNumber,
      maxPlayers: this.maxPlayers,
      playerCount: this.players.length,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        isAlive: p.isAlive,
        isConnected: p.isConnected,
        silenced: isSilenced(p, this.dayNumber),
        ...((!p.isAlive || this.phase === GamePhase.FIN) && p.role ? { role: p.role } : {}),
      })),
      votes: { ...this.votes },
      winner: this.winner,
      soloWinner: this.soloWinner,
    };
  }

  /** Oculta campos sensibles de metadata ajena (infección, Phisher, objetivos internos). */
  private sanitizeMetadata(metadata: any, isSelf = false) {
    if (!metadata || isSelf) return metadata;
    const {
      phisherRedirects,
      infection,
      lastProtectedTarget,
      lastCuredTarget,
      assumedFromPlayerId,
      honeypotDragTarget,
      ...rest
    } = metadata;
    return rest;
  }

  private playerToPlain(p: Player) {
    return {
      id: p.id,
      name: p.name,
      socketId: p.socketId,
      role: p.role,
      team: p.team,
      isAlive: p.isAlive,
      isConnected: p.isConnected,
      joinedAt: p.joinedAt,
      metadata: p.metadata,
    };
  }

  addPlayer(p: Player) {
    if (this.players.length >= this.maxPlayers) {
      throw new Error(`Room is full (max ${this.maxPlayers} players)`);
    }
    this.players.push(p);
  }

  removePlayer(playerId: string) {
    this.players = this.players.filter(p => p.id !== playerId);
  }

  getPlayer(playerId: string) {
    return this.players.find(p => p.id === playerId) || null;
  }

  getAlivePlayers() {
    return this.players.filter(p => p.isAlive);
  }

  setPhase(phase: GamePhase) {
    this.phase = phase;
    this.phaseStartedAt = Date.now();
    if (phase === GamePhase.DIA) this.dayNumber += 1;
    if (phase === GamePhase.NOCHE) this.nightNumber += 1;
  }

  queueAction(action: PlayerAction) {
    this.stateRemoveDuplicateActor(action.actor);
    this.actionQueue.push(action);
  }

  private stateRemoveDuplicateActor(actorId: string) {
    this.actionQueue = this.actionQueue.filter(a => a.actor !== actorId);
  }

  clearActions() {
    this.actionQueue = [];
  }

  log(entry: string) {
    this.logs.push(`[${new Date().toISOString()}] ${entry}`);
  }

  /** Aplica mapas Phisher activos: si `voterId` fue engañado, sustituye su objetivo de voto. */
  resolvePhisherRedirect(voterId: string, targetId: string | null): string | null {
    for (const p of this.players) {
      const redirects = getMeta(p).phisherRedirects;
      if (redirects && redirects[voterId]) return redirects[voterId];
    }
    return targetId;
  }
}
