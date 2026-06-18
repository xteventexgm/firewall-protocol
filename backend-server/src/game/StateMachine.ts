import { EventEmitter } from 'events';
import { GamePhase } from '../types';

type PhaseCallback = (from: GamePhase, to: GamePhase) => void;

const ALLOWED_TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  [GamePhase.LOBBY]: [GamePhase.REPARTO],
  [GamePhase.REPARTO]: [GamePhase.NOCHE],
  [GamePhase.NOCHE]: [GamePhase.DIA],
  [GamePhase.DIA]: [GamePhase.VOTACION],
  [GamePhase.VOTACION]: [GamePhase.VERIFICACION],
  [GamePhase.VERIFICACION]: [GamePhase.NOCHE, GamePhase.FIN],
  [GamePhase.FIN]: [],
};

export class StateMachine extends EventEmitter {
  private phase: GamePhase;
  private phaseStartedAt: number;

  constructor(initial: GamePhase = GamePhase.LOBBY) {
    super();
    this.phase = initial;
    this.phaseStartedAt = Date.now();
  }

  getPhase() {
    return this.phase;
  }

  getPhaseStartedAt() {
    return this.phaseStartedAt;
  }

  /** Restaura fase desde persistencia sin emitir eventos ni validar transiciones. */
  restorePhase(phase: GamePhase, phaseStartedAt?: number) {
    this.phase = phase;
    this.phaseStartedAt = phaseStartedAt ?? Date.now();
  }

  canTransitionTo(target: GamePhase) {
    const allowed = ALLOWED_TRANSITIONS[this.phase] || [];
    return allowed.includes(target);
  }

  transitionTo(target: GamePhase) {
    if (target === this.phase) return false;
    if (!this.canTransitionTo(target)) {
      throw new Error(`Invalid transition from ${this.phase} to ${target}`);
    }

    const from = this.phase;
    this.phase = target;
    this.phaseStartedAt = Date.now();
    // emit a typed event
    this.emit('phaseChanged', { from, to: target, at: this.phaseStartedAt });
    return true;
  }

  onPhaseChanged(cb: PhaseCallback) {
    this.on('phaseChanged', ({ from, to }: any) => cb(from, to));
  }

  // helper for forcing a next logical phase (used by Room manager)
  next() {
    const nextPhases = ALLOWED_TRANSITIONS[this.phase] || [];
    if (nextPhases.length === 0) return null;
    // deterministic choice: pick first
    const nextPhase = nextPhases[0];
    this.transitionTo(nextPhase);
    return nextPhase;
  }
}

export default StateMachine;
