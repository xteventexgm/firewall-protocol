import { EventEmitter } from 'events';
import StateMachine from './StateMachine';
import { GameStateModel } from '../models/GameState';
import { Player } from '../models/PlayerProfile';
import assignRoles from './Matchmaking';
import resolveNightActions from './RuleEngine';
import { GamePhase, IncidentReport } from '../types';
import { NightActionBatch } from '../types/events.types';
import { ROLE_CATALOG, RoleName, Team } from '../types/roles.types';
import database from '../config/database';
import { logger } from '../utils/logger';
import { MIN_PLAYERS } from '../utils/constants';
import {
  validateNightAction,
  markActionSubmitted,
  revertQueuedActionMetadata,
  getHackerTeam,
} from './ActionValidator';
import { checkAnyWin, tickRansomwareCooldowns } from './VictoryChecker';
import { initRoleMetadata, getMeta, isSilenced, resetNightFlags } from './playerMetadata';
import { buildRoleAssignedPayload } from './roleInfo';
import { frozenActorsForValidation } from './nightFreeze';

export class RoomJoinDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoomJoinDeniedError';
  }
}

export type ActionSubmitResult = { ok: true } | { ok: false; reason: string };

export type VoteResolution = {
  eliminated: string | null;
  tied: boolean;
  skipVotes: number;
  voteCount: number;
  candidates: string[];
  reason: 'eliminated' | 'tie' | 'no_votes';
};

export interface RoomOptions {
  nightDurationMs?: number;
  dayDurationMs?: number;
  autoAdvance?: boolean;
  /** Cupo máximo de jugadores (obligatorio al crear desde dashboard). */
  maxPlayers?: number;
  /** Si false, no carga JSON al crear (solo salas nuevas desde dashboard). */
  restore?: boolean;
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
    if (options.maxPlayers !== undefined) {
      this.state.maxPlayers = options.maxPlayers;
    }
    this.sm = new StateMachine();
    this.options = Object.assign({ nightDurationMs: 60_000, dayDurationMs: 60_000, autoAdvance: false }, options);

    try {
      if (options.restore !== false) {
        const persisted = database.load(this.id);
        if (persisted) {
          this.state = GameStateModel.fromObject(persisted);
          this.sm.restorePhase(this.state.phase, this.state.phaseStartedAt);
          logger.info('Restored game state for room', this.id, 'phase=', this.state.phase);
        }
      }
    } catch (err: any) {
      logger.error('Error restoring state for room', this.id, err.message || err);
    }

    this.sm.on('phaseChanged', ({ from, to, at }: any) => {
      this.state.setPhase(to);
      if (to === GamePhase.NOCHE) {
        resetNightFlags(this.state.players);
        tickRansomwareCooldowns(this.state);
      }
      this.emit('phaseChanged', { roomId: this.id, from, to, at });
      this.emit('phaseTransition', { roomId: this.id, from, to, at });

      try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on phaseChanged', e); }
      if (this.options.autoAdvance) this.schedulePhaseTimeout(to);
    });
  }

  addPlayer(p: Player) {
    if (this.sm.getPhase() !== GamePhase.LOBBY) {
      throw new RoomJoinDeniedError(
        `Game already started. New players cannot join room ${this.id}.`,
      );
    }
    if (this.state.players.length >= this.state.maxPlayers) {
      throw new Error(`Room is full (max ${this.state.maxPlayers} players)`);
    }
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
    this.emitPrivateRoleInfo(existing);
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
      if (r) {
        p.role = r;
        p.team = ROLE_CATALOG[r].team;
        p.metadata = initRoleMetadata(r);
      }
    }

    this.emit('rolesAssigned', { roomId: this.id, assignments, hackerCount });

    for (const p of players) {
      this.emitPrivateRoleInfo(p);
    }

    const hackers = getHackerTeam(this.state);
    for (const p of players) {
      if (p.team === Team.BLACK_HAT) {
        this.emit('privateResult', {
          roomId: this.id,
          playerId: p.id,
          payload: { type: 'hacker_team', members: hackers },
        });
      }
    }

    this.sm.transitionTo(GamePhase.DIA);
  }

  private emitPrivateRoleInfo(player: Player) {
    if (!player.role) return;
    this.emit('privateResult', {
      roomId: this.id,
      playerId: player.id,
      payload: buildRoleAssignedPayload(player.role, player.team as Team),
    });
  }

  submitAction(action: any): ActionSubmitResult {
    if (this.sm.getPhase() !== GamePhase.NOCHE) {
      return { ok: false, reason: 'Not accepting actions outside NOCHE' };
    }

    const frozen = frozenActorsForValidation(this.state.actionQueue, action);
    const err = validateNightAction(action, this.state, this.sm.getPhase(), frozen);
    if (err) {
      return { ok: false, reason: `Action rejected: ${err}` };
    }

    const actor = this.state.getPlayer(action.actor)!;
    const type = (action.type || '').toLowerCase();

    const previous = this.state.actionQueue.find(a => a.actor === action.actor);
    if (previous) {
      revertQueuedActionMetadata(actor, previous.type, previous.target);
    }

    this.state.queueAction(action);
    markActionSubmitted(actor, type, action.target);

    this.emit('actionAccepted', { roomId: this.id, actionId: action.id });
    try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on submitAction', e); }
    return { ok: true };
  }

  submitVote(voter: string, target: string | null): ActionSubmitResult {
    if (this.sm.getPhase() !== GamePhase.VOTACION) {
      return { ok: false, reason: 'Voting only allowed during VOTACION' };
    }

    const voterPlayer = this.state.getPlayer(voter);
    if (!voterPlayer || !voterPlayer.isAlive) {
      return { ok: false, reason: 'Voter not found or eliminated' };
    }
    if (isSilenced(voterPlayer, this.state.dayNumber)) {
      return { ok: false, reason: 'Voter is silenced' };
    }

    const resolvedTarget = this.state.resolvePhisherRedirect(voter, target);

    for (const key of Object.keys(this.state.votes)) {
      this.state.votes[key] = this.state.votes[key].filter(v => v !== voter);
      if (this.state.votes[key].length === 0) delete this.state.votes[key];
    }

    // Skip / voto en blanco — entidad separada bajo clave 'skip'
    const key = resolvedTarget ?? 'skip';
    this.state.votes[key] = this.state.votes[key] || [];
    this.state.votes[key].push(voter);

    this.emit('voteRecorded', {
      roomId: this.id,
      voter,
      target: resolvedTarget,
      timestamp: Date.now(),
    });

    try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on submitVote', e); }
    return { ok: true };
  }

  private resolveVotes(): VoteResolution {
    const aliveIds = new Set(this.state.getAlivePlayers().map(p => p.id));
    const tallies = new Map<string, number>();

    const skipVoters = (this.state.votes['skip'] ?? []).filter(v => aliveIds.has(v));
    const skipVotes = skipVoters.length;

    for (const [target, voters] of Object.entries(this.state.votes)) {
      if (target === 'skip' || target === 'null') continue;
      const validVotes = voters.filter(v => aliveIds.has(v));
      if (validVotes.length > 0) {
        tallies.set(target, validVotes.length);
      }
    }

    let eliminated: string | null = null;

    if (tallies.size === 0) {
      this.state.log(`No elimination votes (skip: ${skipVotes}) — proceeding to NOCHE`);
      this.emit('voteTied', {
        roomId: this.id,
        voteCount: 0,
        candidates: [],
        skipVotes,
        reason: 'no_votes',
      });
      this.state.votes = {};
      this.clearPhisherRedirects();
      return {
        eliminated: null,
        tied: true,
        skipVotes,
        voteCount: 0,
        candidates: [],
        reason: 'no_votes',
      };
    }

    const maxVotes = Math.max(...tallies.values());
    const leaders = [...tallies.entries()].filter(([, count]) => count === maxVotes);
    const candidates = leaders.map(([target]) => target);

    if (leaders.length > 1) {
      this.state.log(`Vote tied at ${maxVotes} votes (skip: ${skipVotes}) — no elimination, proceeding to NOCHE`);
      this.emit('voteTied', {
        roomId: this.id,
        voteCount: maxVotes,
        candidates,
        skipVotes,
        reason: 'tie',
      });
      this.state.votes = {};
      this.clearPhisherRedirects();
      return {
        eliminated: null,
        tied: true,
        skipVotes,
        voteCount: maxVotes,
        candidates,
        reason: 'tie',
      };
    }

    const [bestTarget, bestCount] = leaders[0];
    const player = this.state.getPlayer(bestTarget);
    if (player?.isAlive) {
      player.isAlive = false;
      eliminated = bestTarget;
      this.state.log(`Voted out: ${bestTarget} (${bestCount} votes, skip: ${skipVotes})`);
      this.emit('playerEliminated', { roomId: this.id, playerId: bestTarget, reason: 'vote' });
      this.applyHoneypotBanDrag(bestTarget);
    }

    this.state.votes = {};
    this.clearPhisherRedirects();

    return {
      eliminated,
      tied: false,
      skipVotes,
      voteCount: bestCount,
      candidates: [bestTarget],
      reason: 'eliminated',
    };
  }

  private clearPhisherRedirects() {
    for (const p of this.state.players) {
      const meta = getMeta(p);
      if (meta.phisherRedirects) meta.phisherRedirects = {};
    }
  }

  private applyHoneypotBanDrag(honeypotId: string) {
    const honeypot = this.state.getPlayer(honeypotId);
    if (honeypot?.role !== RoleName.HONEYPOT) return;
    const dragTarget = getMeta(honeypot).honeypotDragTarget;
    if (!dragTarget) return;
    const dragged = this.state.getPlayer(dragTarget);
    if (dragged?.isAlive) {
      dragged.isAlive = false;
      this.state.log(`Honeypot drag on ban: ${dragTarget}`);
      this.emit('playerEliminated', { roomId: this.id, playerId: dragTarget, reason: 'honeypot_drag' });
    }
  }

  private endGame(result: ReturnType<typeof checkAnyWin>) {
    if (!result.over) return false;

    if (result.type === 'team') {
      this.state.winner = result.winner;
      this.state.log(`Game over: ${result.winner} wins`);
      this.sm.transitionTo(GamePhase.FIN);
      this.emit('gameOver', { roomId: this.id, winner: result.winner, soloWinner: null });
    } else {
      this.state.soloWinner = result.solo;
      this.state.log(`Game over: solo win ${result.solo.playerId}`);
      this.sm.transitionTo(GamePhase.FIN);
      this.emit('gameOver', { roomId: this.id, winner: null, soloWinner: result.solo });
    }

    try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on gameOver', e); }
    return true;
  }

  async advancePhase() {
    if (this.sm.getPhase() === GamePhase.FIN) return null;

    const current = this.sm.getPhase();

    // Recupera partidas atascadas (ej. solo Gusano vivo en DIA tras kill nocturna previa).
    if (current !== GamePhase.NOCHE && this.endGame(checkAnyWin(this.state))) {
      return GamePhase.FIN;
    }

    if (current === GamePhase.NOCHE) {
      const batch: NightActionBatch = { roomId: this.id, phase: GamePhase.NOCHE, actions: this.state.actionQueue };
      const resolution = resolveNightActions(batch, this.state);

      for (const pr of resolution.privateResults) {
        this.emit('privateResult', { roomId: this.id, playerId: pr.playerId, payload: pr.payload });
      }

      this.emit('nightResolved', { roomId: this.id, resolution });
      try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving after nightResolved', e); }

      const winAfterNight = checkAnyWin(this.state);
      if (this.endGame(winAfterNight)) return GamePhase.FIN;

      const nextPhase = this.sm.next();
      if (!nextPhase) return null;

      if (nextPhase === GamePhase.DIA) {
        const report: IncidentReport = {
          roomId: this.id,
          nightNumber: this.state.nightNumber,
          disconnected: [...this.state.lastNightKills],
        };
        this.emit('incidentReport', report);
      }
      return nextPhase;
    }

    if (current === GamePhase.VOTACION) {
      const voteResult = this.resolveVotes();
      try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving after resolveVotes', e); }

      if (voteResult.tied) {
        this.sm.transitionTo(GamePhase.NOCHE);
        return GamePhase.NOCHE;
      }

      const soloAfterVote = checkAnyWin(this.state, { justVotedOut: voteResult.eliminated ?? undefined });
      if (this.endGame(soloAfterVote)) return GamePhase.FIN;

      this.sm.transitionTo(GamePhase.VERIFICACION);
      const result = checkAnyWin(this.state);
      if (this.endGame(result)) return GamePhase.FIN;
      return GamePhase.VERIFICACION;
    }

    const nextPhase = this.sm.next();
    if (!nextPhase) return null;

    if (nextPhase === GamePhase.VERIFICACION) {
      const result = checkAnyWin(this.state);
      if (this.endGame(result)) return GamePhase.FIN;
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
