/**
 * Máquina de estados de fases de partida.
 *
 * Flujo principal: LOBBY → REPARTO → DIA ↔ NOCHE ↔ VOTACION → VERIFICACION → FIN
 * Emite `phaseChanged` al transicionar; Room escucha y persiste + socket bridge.
 *
 * `restorePhase` rehidrata desde JSON sin validar transiciones ni emitir eventos.
 */
import { EventEmitter } from 'events';
import { GamePhase } from '../types';

/** Grafo de transiciones permitidas entre fases. */
const ALLOWED_TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  [GamePhase.LOBBY]: [GamePhase.REPARTO],
  [GamePhase.REPARTO]: [GamePhase.DIA],
  [GamePhase.NOCHE]: [GamePhase.DIA],
  [GamePhase.DIA]: [GamePhase.VOTACION],
  [GamePhase.VOTACION]: [GamePhase.VERIFICACION, GamePhase.NOCHE],
  [GamePhase.VERIFICACION]: [GamePhase.NOCHE, GamePhase.FIN],
  [GamePhase.FIN]: [],
};

/** Fase actual y timestamps; integrada en cada instancia de `Room`. */
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
    if (target === GamePhase.FIN) {
      const from = this.phase;
      this.phase = GamePhase.FIN;
      this.phaseStartedAt = Date.now();
      this.emit('phaseChanged', { from, to: target, at: this.phaseStartedAt });
      return true;
    }
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

  /** Avanza a la primera fase siguiente permitida (elección determinista para el host). */
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
