import { GamePhase, PlayerAction } from '../types';
import { Player, PlayerProfile } from './PlayerProfile';

export interface GameState {
  roomId: string;
  phase: GamePhase;
  phaseStartedAt: number;
  players: PlayerProfile[];
  dayNumber: number;
  nightNumber: number;
  actionQueue: PlayerAction[]; // accumulated night actions
  votes: Record<string, string[]>; // target -> voter ids
  logs: string[];
}

export class GameStateModel implements GameState {
  roomId: string;
  phase: GamePhase = GamePhase.LOBBY;
  phaseStartedAt: number = Date.now();
  players: Player[] = [];
  dayNumber = 0;
  nightNumber = 0;
  actionQueue: PlayerAction[] = [];
  votes: Record<string, string[]> = {};
  logs: string[] = [];

  constructor(roomId: string) {
    this.roomId = roomId;
  }

  static fromObject(obj: any) {
    const s = new GameStateModel(obj.roomId || '');
    s.phase = obj.phase;
    s.phaseStartedAt = obj.phaseStartedAt || Date.now();
    s.dayNumber = obj.dayNumber || 0;
    s.nightNumber = obj.nightNumber || 0;
    s.actionQueue = obj.actionQueue || [];
    s.votes = obj.votes || {};
    s.logs = obj.logs || [];
    s.players = (obj.players || []).map((p: any) => {
      const pl = new Player(p.id, p.name, p.socketId);
      pl.role = p.role;
      pl.team = p.team;
      pl.isAlive = p.isAlive !== false;
      pl.isConnected = false;
      pl.joinedAt = p.joinedAt || Date.now();
      pl.metadata = p.metadata || {};
      pl.pendingActions = p.pendingActions || [];
      return pl;
    });
    return s;
  }

  toPlain() {
    return {
      roomId: this.roomId,
      phase: this.phase,
      phaseStartedAt: this.phaseStartedAt,
      players: this.players.map(p => ({ id: p.id, name: p.name, socketId: p.socketId, role: p.role, team: p.team, isAlive: p.isAlive, isConnected: p.isConnected, joinedAt: p.joinedAt, metadata: p.metadata, pendingActions: p.pendingActions })),
      dayNumber: this.dayNumber,
      nightNumber: this.nightNumber,
      actionQueue: this.actionQueue,
      votes: this.votes,
      logs: this.logs,
    };
  }

  addPlayer(p: Player) {
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
    this.actionQueue.push(action);
  }

  clearActions() {
    this.actionQueue = [];
  }

  log(entry: string) {
    this.logs.push(`[${new Date().toISOString()}] ${entry}`);
  }
}