import { EventEmitter } from 'events';
import StateMachine from './StateMachine';
import { GameStateModel } from '../models/GameState';
import { Player } from '../models/PlayerProfile';
import assignRoles from './Matchmaking';
import resolveNightActions from './RuleEngine';
import { GamePhase } from '../types';
import { NightActionBatch } from '../types/events.types';
import database from '../config/database';
import { logger } from '../utils/logger';

export interface RoomOptions {
  nightDurationMs?: number;
  dayDurationMs?: number;
  autoAdvance?: boolean; // if true, auto-advance phases after durations
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

    // try to restore persisted state
    try {
      const persisted = database.load(this.id);
      if (persisted) {
        this.state = GameStateModel.fromObject(persisted);
        logger.info('Restored game state for room', this.id);
      }
    } catch (err: any) {
      logger.error('Error restoring state for room', this.id, err.message || err);
    }

    this.sm.on('phaseChanged', ({ from, to, at }: any) => {
      this.state.setPhase(to);
      this.emit('phaseChanged', { roomId: this.id, from, to, at });
      // persist state on phase changes
      try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on phaseChanged', e); }
      // auto-advance if configured
      if (this.options.autoAdvance) this.schedulePhaseTimeout(to);
    });
  }

  addPlayer(p: Player) {
    this.state.addPlayer(p);
    this.emit('playerJoined', { roomId: this.id, player: p });
    try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on addPlayer', e); }
  }

  removePlayer(playerId: string) {
    this.state.removePlayer(playerId);
    this.emit('playerLeft', { roomId: this.id, playerId });
    try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on removePlayer', e); }
  }

  startGame() {
    // begin reparto
    this.sm.transitionTo(GamePhase.REPARTO);

    // assign roles
    const players = this.state.players as Player[];
    const { assignments, hackerCount } = assignRoles(players);
    this.state.log(`Assigned roles: hackers=${hackerCount}`);
    for (const p of players) {
      const r = assignments[p.id];
      if (r) p.role = r;
      p.team = p.role ? (p.role && (require('../types/roles.types').ROLE_CATALOG[p.role].team)) : undefined;
    }

    this.emit('rolesAssigned', { roomId: this.id, assignments, hackerCount });

    // move to first night after reparto
    this.sm.transitionTo(GamePhase.NOCHE);
  }

  submitAction(action: any) {
    // accept actions only during night
    if (this.sm.getPhase() !== GamePhase.NOCHE) {
      this.emit('error', { roomId: this.id, msg: 'Not accepting actions outside NOCHE' });
      return false;
    }
    this.state.queueAction(action);
    this.emit('actionAccepted', { roomId: this.id, actionId: action.id });
    return true;
  }

  async advancePhase() {
    // advance state machine deterministically
    const current = this.sm.getPhase();
    const nextPhase = this.sm.next();
    if (!nextPhase) return null;

    // handle phase-specific logic
    if (current === GamePhase.NOCHE && nextPhase === GamePhase.DIA) {
      // resolve night actions
      const batch: NightActionBatch = { roomId: this.id, phase: GamePhase.NOCHE, actions: this.state.actionQueue };
      const resolution = resolveNightActions(batch, this.state);
      this.emit('nightResolved', { roomId: this.id, resolution });
      try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving after nightResolved', e); }
    }

    if (nextPhase === GamePhase.VERIFICACION) {
      // placeholder: could run verification/confirmation mechanics
      this.emit('verificationStart', { roomId: this.id });
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
