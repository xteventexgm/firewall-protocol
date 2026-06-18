import { EventEmitter } from 'events';
import StateMachine from './StateMachine';
import { GameStateModel } from '../models/GameState';
import { Player } from '../models/PlayerProfile';
import assignRoles from './Matchmaking';
import resolveNightActions from './RuleEngine';
import { GamePhase } from '../types';
import { NightActionBatch } from '../types/events.types';
import { ROLE_CATALOG, Team } from '../types/roles.types';
import database from '../config/database';
import { logger } from '../utils/logger';
import { MIN_PLAYERS } from '../utils/constants';

export interface RoomOptions {
  nightDurationMs?: number;
  dayDurationMs?: number;
  autoAdvance?: boolean;
}

export class Room extends EventEmitter {
  id: string;
  state: GameStateModel;
  sm: StateMachine;
  options: RoomOptions;
  private timer?: NodeJS.Timeout | null;

  constructor(id: string, options: RoomOptions = {}) {
    super();
    this.id = id;
    this.state = new GameStateModel(id);
    this.sm = new StateMachine();
    this.options = Object.assign({ nightDurationMs: 60_000, dayDurationMs: 60_000, autoAdvance: false }, options);

    try {
      const persisted = database.load(this.id);
      if (persisted) {
        this.state = GameStateModel.fromObject(persisted);
        this.sm.restorePhase(this.state.phase, this.state.phaseStartedAt);
        logger.info('Restored game state for room', this.id, 'phase=', this.state.phase);
      }
    } catch (err: any) {
      logger.error('Error restoring state for room', this.id, err.message || err);
    }

    this.sm.on('phaseChanged', ({ from, to, at }: any) => {
      this.state.setPhase(to);
      this.emit('phaseChanged', { roomId: this.id, from, to, at });
      try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on phaseChanged', e); }
      if (this.options.autoAdvance) this.schedulePhaseTimeout(to);
    });
  }

  addPlayer(p: Player) {
    this.state.addPlayer(p);
    this.emit('playerJoined', { roomId: this.id, player: p });
    try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on addPlayer', e); }
  }

  reconnectPlayer(playerId: string, socketId: string, name?: string) {
    const existing = this.state.getPlayer(playerId);
    if (!existing) return false;
    existing.socketId = socketId;
    existing.isConnected = true;
    if (name) existing.name = name;
    this.emit('playerReconnected', { roomId: this.id, playerId });
    try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on reconnectPlayer', e); }
    return true;
  }

  markPlayerDisconnected(socketId: string): boolean {
    const player = this.state.players.find(p => p.socketId === socketId);
    if (!player) return false;
    player.isConnected = false;
    player.socketId = undefined;
    this.emit('playerDisconnected', { roomId: this.id, playerId: player.id });
    try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on markPlayerDisconnected', e); }
    return true;
  }

  removePlayer(playerId: string) {
    this.state.removePlayer(playerId);
    this.emit('playerLeft', { roomId: this.id, playerId });
    try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on removePlayer', e); }
  }

  startGame() {
    if (this.sm.getPhase() !== GamePhase.LOBBY) {
      throw new Error('Game can only be started from LOBBY');
    }
    if (this.state.players.length < MIN_PLAYERS) {
      throw new Error(`Need at least ${MIN_PLAYERS} players to start`);
    }

    this.sm.transitionTo(GamePhase.REPARTO);

    const players = this.state.players as Player[];
    const { assignments, hackerCount } = assignRoles(players);
    this.state.log(`Assigned roles: hackers=${hackerCount}`);
    for (const p of players) {
      const r = assignments[p.id];
      if (r) p.role = r;
      p.team = p.role ? ROLE_CATALOG[p.role].team : undefined;
    }

    this.emit('rolesAssigned', { roomId: this.id, assignments, hackerCount });
    this.sm.transitionTo(GamePhase.NOCHE);
  }

  submitAction(action: any) {
    if (this.sm.getPhase() !== GamePhase.NOCHE) {
      this.emit('error', { roomId: this.id, msg: 'Not accepting actions outside NOCHE' });
      return false;
    }
    this.state.queueAction(action);
    this.emit('actionAccepted', { roomId: this.id, actionId: action.id });
    return true;
  }

  submitVote(voter: string, target: string | null): boolean {
    if (this.sm.getPhase() !== GamePhase.VOTACION) {
      this.emit('error', { roomId: this.id, msg: 'Voting only allowed during VOTACION' });
      return false;
    }
    const voterPlayer = this.state.getPlayer(voter);
    if (!voterPlayer || !voterPlayer.isAlive) return false;

    for (const key of Object.keys(this.state.votes)) {
      this.state.votes[key] = this.state.votes[key].filter(v => v !== voter);
      if (this.state.votes[key].length === 0) delete this.state.votes[key];
    }

    const key = target || 'null';
    this.state.votes[key] = this.state.votes[key] || [];
    this.state.votes[key].push(voter);
    this.emit('voteRecorded', { roomId: this.id, voter, target });
    try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on submitVote', e); }
    return true;
  }

  private resolveVotes() {
    const aliveIds = new Set(this.state.getAlivePlayers().map(p => p.id));
    let bestTarget: string | null = null;
    let bestCount = 0;
    let tie = false;

    for (const [target, voters] of Object.entries(this.state.votes)) {
      if (target === 'null') continue;
      const validVotes = voters.filter(v => aliveIds.has(v));
      if (validVotes.length > bestCount) {
        bestCount = validVotes.length;
        bestTarget = target;
        tie = false;
      } else if (validVotes.length === bestCount && validVotes.length > 0) {
        tie = true;
      }
    }

    if (bestTarget && !tie && bestCount > 0) {
      const player = this.state.getPlayer(bestTarget);
      if (player?.isAlive) {
        player.isAlive = false;
        this.state.log(`Voted out: ${bestTarget} (${bestCount} votes)`);
        this.emit('playerEliminated', { roomId: this.id, playerId: bestTarget, reason: 'vote' });
      }
    } else if (tie) {
      this.state.log('Vote tied — no elimination');
    }

    this.state.votes = {};
  }

  private checkWinCondition(): { over: boolean; winner?: Team } {
    const alive = this.state.getAlivePlayers();
    const hackers = alive.filter(p => p.team === Team.BLACK_HAT);
    const others = alive.filter(p => p.team !== Team.BLACK_HAT);

    if (hackers.length === 0) return { over: true, winner: Team.SYSTEM };
    if (hackers.length >= others.length) return { over: true, winner: Team.BLACK_HAT };
    return { over: false };
  }

  async advancePhase() {
    if (this.sm.getPhase() === GamePhase.FIN) return null;

    const current = this.sm.getPhase();
    const nextPhase = this.sm.next();
    if (!nextPhase) return null;

    if (current === GamePhase.NOCHE && nextPhase === GamePhase.DIA) {
      const batch: NightActionBatch = { roomId: this.id, phase: GamePhase.NOCHE, actions: this.state.actionQueue };
      const resolution = resolveNightActions(batch, this.state);
      this.emit('nightResolved', { roomId: this.id, resolution });
      try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving after nightResolved', e); }
    }

    if (current === GamePhase.VOTACION && nextPhase === GamePhase.VERIFICACION) {
      this.resolveVotes();
      try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving after resolveVotes', e); }
    }

    if (nextPhase === GamePhase.VERIFICACION) {
      const result = this.checkWinCondition();
      if (result.over && result.winner) {
        this.state.winner = result.winner;
        this.state.log(`Game over: ${result.winner} wins`);
        this.sm.transitionTo(GamePhase.FIN);
        this.emit('gameOver', { roomId: this.id, winner: result.winner });
        try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on gameOver', e); }
        return GamePhase.FIN;
      }
    }

    return nextPhase;
  }

  schedulePhaseTimeout(phase: GamePhase) {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    let ms = 0;
    if (phase === GamePhase.NOCHE) ms = this.options.nightDurationMs || 0;
    if (phase === GamePhase.DIA) ms = this.options.dayDurationMs || 0;
    if (ms > 0) {
      this.timer = setTimeout(() => { this.advancePhase(); }, ms);
    }
  }

  destroy() {
    if (this.timer) clearTimeout(this.timer);
    this.removeAllListeners();
  }
}

export default Room;
