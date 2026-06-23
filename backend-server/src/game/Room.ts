/**
 * Orquestador de partida: una instancia por sala.
 *
 * Responsabilidades:
 * - Ciclo join / reconnect / leave / startGame / advancePhase
 * - Validar y encolar acciones; resolver votos; emitir eventos internos
 * - Persistir en JSON tras cambios relevantes
 * - Delegar resolución nocturna a RuleEngine y victoria a VictoryChecker
 *
 * Eventos internos consumidos por `sockets/roomBridge.ts` → clientes.
 */
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
  formatActionValidationError,
} from './ActionValidator';
import { checkAnyWin, tickRansomwareCooldowns } from './VictoryChecker';
import { initRoleMetadata, getMeta, isSilenced, isVoteBlocked, resetNightFlags } from './playerMetadata';
import { buildRoleAssignedPayload } from './roleInfo';
import { defaultRoomOptions } from '../config/env';
import { frozenActorsForValidation } from './nightFreeze';
import { computeVoteResolution, isVoteTieResult } from './voteResolution';
import {
  buildGameStartLogs,
  buildNightPublicLogs,
  buildVoteLog,
  buildTrollProvokeLog,
  buildGameOverLog,
} from './PublicLogService';
import { submitChatMessage } from './ChatManager';
import {
  createChallenge,
  resolveForNightAction,
  skipChallenge,
  toChallengePayload,
  tryChallengeAnswer,
} from './MinigameChallengeManager';
import {
  initGameStats,
  recordNightStats,
  recordVote,
  recordPlayerAction,
  computeMvp,
  buildStatsEntries,
} from './GameStatsTracker';
import { TROLL_PROVOKE_MESSAGES } from './trollProvoke';
import { WHITE_NOISE_MESSAGES } from './whiteNoise';
import { PhaseConfig } from '../types';
import { clearBots, runBotQaMatch as startBotQaMatch, verificationPhaseDurationMs, addOneBot } from './BotController';

/** Intento de unirse a partida ya iniciada (solo LOBBY acepta nuevos jugadores). */
export class RoomJoinDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoomJoinDeniedError';
  }
}

/** Resultado de submitAction / submitVote hacia handlers socket. */
export type ActionSubmitResult = { ok: true } | { ok: false; reason: string };

export type { VoteResolution } from './voteResolution';

/** Opciones de construcción de sala (timers, maxPlayers, restauración desde disco). */
export interface RoomOptions {
  nightDurationMs?: number;
  dayDurationMs?: number;
  autoAdvance?: boolean;
  /** Cupo máximo de jugadores (obligatorio al crear desde dashboard). */
  maxPlayers?: number;
  /** Si false, no carga JSON al crear (solo salas nuevas desde dashboard). */
  restore?: boolean;
}

/** Sala de juego activa; emite eventos de dominio y persiste estado. */
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
    this.options = { ...defaultRoomOptions(), ...options };
    this.state.phaseConfig = {
      autoAdvance: this.options.autoAdvance ?? false,
      nightDurationMs: this.options.nightDurationMs ?? 90_000,
      dayDurationMs: this.options.dayDurationMs ?? 120_000,
      voteDurationMs: 90_000,
    };

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
        this.state.votes = {};
      }
      if (to === GamePhase.VOTACION) {
        this.state.votes = {};
      }
      this.state.phaseStartedAt = at ?? Date.now();
      this.updatePhaseEndsAt(to);
      if (this.state.phaseConfig.autoAdvance) this.schedulePhaseTimeout(to);
      this.emit('phaseChanged', { roomId: this.id, from, to, at });
      this.emit('phaseTransition', { roomId: this.id, from, to, at });

      try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on phaseChanged', e); }
    });
  }

  private updatePhaseEndsAt(phase: GamePhase) {
    const cfg = this.state.phaseConfig;
    let ms = 0;
    if (phase === GamePhase.NOCHE) ms = cfg.nightDurationMs;
    if (phase === GamePhase.DIA) ms = cfg.dayDurationMs;
    if (phase === GamePhase.VOTACION) ms = cfg.voteDurationMs;
    if (phase === GamePhase.VERIFICACION) ms = verificationPhaseDurationMs();
    this.state.phaseEndsAt = ms > 0 && cfg.autoAdvance ? Date.now() + ms : null;
  }

  setPhaseConfig(patch: Partial<PhaseConfig>) {
    this.state.phaseConfig = { ...this.state.phaseConfig, ...patch };
    this.options.autoAdvance = this.state.phaseConfig.autoAdvance;
    this.options.nightDurationMs = this.state.phaseConfig.nightDurationMs;
    this.options.dayDurationMs = this.state.phaseConfig.dayDurationMs;
    this.updatePhaseEndsAt(this.sm.getPhase());
    this.emit('phaseConfigChanged', { roomId: this.id, config: this.state.phaseConfig });
    try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving phaseConfig', e); }
  }

  requestMinigame(playerId: string) {
    const player = this.state.getPlayer(playerId);
    if (!player?.role || this.sm.getPhase() !== GamePhase.NOCHE) return null;
    const challenge = createChallenge(player.role as RoleName, playerId);
    this.emit('minigameChallenge', {
      roomId: this.id,
      playerId,
      challenge: toChallengePayload(challenge),
    });
    return challenge;
  }

  submitMinigameAnswer(playerId: string, token: string, answer: string | number) {
    const player = this.state.getPlayer(playerId);
    if (!player?.role || this.sm.getPhase() !== GamePhase.NOCHE) {
      return { ok: false as const, reason: 'Solo en fase NOCHE (wrong_phase)' };
    }
    const { result, challenge } = tryChallengeAnswer(playerId, token, answer);
    this.emit('minigameAnswerResult', {
      roomId: this.id,
      playerId,
      result,
      successHint: challenge?.successHint,
      failHint: challenge?.failHint,
    });
    return { ok: true as const, result };
  }

  skipMinigame(playerId: string, token: string) {
    const result = skipChallenge(playerId, token);
    this.emit('minigameAnswerResult', {
      roomId: this.id,
      playerId,
      result,
      failHint: 'Reto omitido — tu acción nocturna funcionará con precisión reducida.',
    });
    return { ok: true as const, result };
  }

  submitChat(playerId: string, text: string, channel?: 'public' | 'dead' | 'hacker') {
    const lastSent = this.state.lastChatSentAt[playerId];
    const result = submitChatMessage(this.state, playerId, text, channel, lastSent);
    if (!result.ok) return result;
    this.state.lastChatSentAt[playerId] = Date.now();
    this.emit('chatMessage', { roomId: this.id, message: result.message });
    try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving chat', e); }
    return result;
  }

  submitDayAction(actorId: string, type: string, targetId?: string): ActionSubmitResult {
    const actor = this.state.getPlayer(actorId);
    if (!actor?.isAlive) return { ok: false, reason: 'Jugador no encontrado o eliminado (actor_dead)' };

    if (type === 'emergency_patch') {
      if (this.sm.getPhase() !== GamePhase.VOTACION) {
        return { ok: false, reason: 'Parche de emergencia solo en VOTACION (wrong_phase)' };
      }
      if (actor.role !== RoleName.SYSADMIN) {
        return { ok: false, reason: 'Solo SysAdmin puede usar parche de emergencia (role_mismatch)' };
      }
      const meta = getMeta(actor);
      if (meta.emergencyPatchUsed) {
        return { ok: false, reason: formatActionValidationError('patch_already_used') };
      }
      if (!targetId || targetId === actorId) {
        return { ok: false, reason: 'Objetivo no válido (invalid_target)' };
      }
      const target = this.state.getPlayer(targetId);
      if (!target?.isAlive) return { ok: false, reason: 'Objetivo no válido (invalid_target)' };

      meta.emergencyPatchUsed = true;
      meta.patchedVoterId = targetId;

      for (const key of Object.keys(this.state.votes)) {
        this.state.votes[key] = this.state.votes[key].filter((v) => v !== targetId);
        if (this.state.votes[key].length === 0) delete this.state.votes[key];
      }

      const entry = {
        id: `plog_patch_${Date.now()}`,
        timestamp: Date.now(),
        dayNumber: this.state.dayNumber,
        message: `${new Date().toISOString().slice(11, 16)} UTC — Parche de emergencia aplicado. Un voto anulado.`,
        severity: 'warn' as const,
      };
      this.state.publicLogs.push(entry);
      this.emit('publicLog', { roomId: this.id, entry });
      try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving patch', e); }
      return { ok: true };
    }

    return { ok: false, reason: 'Acción diurna no reconocida (invalid_action_type)' };
  }

  private pushPublicLogs(entries: import('../types/events.types').PublicLogEntry[]) {
    for (const entry of entries) {
      this.state.publicLogs.push(entry);
      this.emit('publicLog', { roomId: this.id, entry });
    }
    if (entries.length > 1) {
      this.emit('publicLogsBatch', { roomId: this.id, entries });
    }
  }

  private emitNightProgress() {
    this.emit('nightProgress', {
      roomId: this.id,
      progress: this.state.computeNightProgress(),
    });
  }

  /** Añade jugador en LOBBY; persiste y emite `playerJoined`. */
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

  /** Reasigna socket tras caída involuntaria de red (no salida voluntaria). */
  reconnectPlayer(playerId: string, socketId: string, name?: string, userId?: string) {
    const existing = this.state.getPlayer(playerId);
    if (!existing) return false;
    existing.socketId = socketId;
    existing.isConnected = true;
    existing.lastDisconnectReason = undefined;
    if (name) existing.name = name;
    if (userId) existing.userId = userId;
    this.emit('playerReconnected', { roomId: this.id, playerId, playerName: existing.name });
    this.emitPrivateRoleInfo(existing);
    try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on reconnectPlayer', e); }
    return true;
  }

  /** Re-entrada voluntaria o nuevo enlace de socket (login / salir y volver). */
  connectPlayer(playerId: string, socketId: string, name?: string, userId?: string) {
    const existing = this.state.getPlayer(playerId);
    if (!existing) return false;
    existing.socketId = socketId;
    existing.isConnected = true;
    existing.lastDisconnectReason = undefined;
    if (name) existing.name = name;
    if (userId) existing.userId = userId;
    this.emit('playerConnected', { roomId: this.id, playerId, playerName: existing.name });
    this.emitPrivateRoleInfo(existing);
    try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on connectPlayer', e); }
    return true;
  }

  /** Marca jugador desconectado por socketId; emite `playerDisconnected`. */
  markPlayerDisconnected(socketId: string, reason: 'voluntary' | 'transport' = 'transport') {
    const player = this.state.players.find(p => p.socketId === socketId);
    if (!player) return false;
    player.isConnected = false;
    player.socketId = undefined;
    player.lastDisconnectReason = reason;
    this.emit('playerDisconnected', { roomId: this.id, playerId: player.id });
    try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on markPlayerDisconnected', e); }
    return true;
  }

  /** Salida voluntaria del jugador (mantiene slot en partida en curso). */
  voluntaryLeave(playerId: string) {
    const player = this.state.getPlayer(playerId);
    if (!player) return false;
    player.isConnected = false;
    player.socketId = undefined;
    player.lastDisconnectReason = 'voluntary';
    this.emit('playerDisconnected', { roomId: this.id, playerId: player.id });
    try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on voluntaryLeave', e); }
    return true;
  }

  removePlayer(playerId: string) {
    this.state.removePlayer(playerId);
    this.emit('playerLeft', { roomId: this.id, playerId });
    try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on removePlayer', e); }
  }

  /**
   * Expulsa un nodo de la sala (solo LOBBY). Bots y jugadores reales.
   * Devuelve datos del socket antes de eliminar al jugador.
   */
  kickPlayer(playerId: string): { playerId: string; playerName: string; socketId?: string; isBot: boolean } {
    if (this.sm.getPhase() !== GamePhase.LOBBY) {
      throw new Error('Solo se puede expulsar jugadores en LOBBY');
    }
    const player = this.state.getPlayer(playerId);
    if (!player) {
      throw new Error('Jugador no encontrado');
    }

    const meta = {
      playerId: player.id,
      playerName: player.name,
      socketId: player.socketId,
      isBot: player.isBot === true,
    };

    this.removePlayer(playerId);
    this.emit('playerKicked', { roomId: this.id, ...meta });

    const tag = meta.isBot ? 'bot' : 'nodo';
    this.state.log(`Host kicked ${tag} ${meta.playerName} (${meta.playerId})`);

    return meta;
  }

  /** Añade un bot (solo LOBBY, requiere jugador real en sala). */
  addOneBotPlayer(): number {
    return addOneBot(this);
  }

  /** QA: elimina todos los bots (solo LOBBY). */
  removeAllBots(): number {
    return clearBots(this);
  }

  /** QA: rellena bots, timers rápidos e inicia partida hasta FIN. */
  runBotQaMatch(): void {
    startBotQaMatch(this);
  }

  /** LOBBY → REPARTO → DIA: asigna roles, metadata inicial y equipo hacker. */
  startGame() {
    if (this.sm.getPhase() !== GamePhase.LOBBY) {
      throw new Error('Game can only be started from LOBBY');
    }
    if (this.state.players.length < MIN_PLAYERS) {
      throw new Error(`Need at least ${MIN_PLAYERS} players to start`);
    }

    this.sm.transitionTo(GamePhase.REPARTO);

    const players = this.state.players as Player[];
    const playerCount = players.length;
    this.state.initialPlayerCount = playerCount;
    this.state.gameStartedAt = Date.now();
    const { assignments, hackerCount, chaoticCount, systemCount } = assignRoles(players);
    this.state.log(`Assigned roles: hackers=${hackerCount}, intruders=${chaoticCount}`);
    this.state.sessionThreatBrief = {
      hackerCount,
      intruderCount: chaoticCount,
      systemCount,
      nodeCount: playerCount,
    };

    for (const p of players) {
      const r = assignments[p.id];
      if (r) {
        p.role = r;
        p.team = ROLE_CATALOG[r].team;
        p.metadata = initRoleMetadata(r, playerCount);
      }
    }

    this.state.gameStats = initGameStats();
    this.emit('rolesAssigned', { roomId: this.id, assignments, hackerCount });

    this.pushPublicLogs(buildGameStartLogs(1));

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

  /** Encola acción nocturna tras validación; reemplaza acción previa del mismo actor. */
  submitAction(action: any): ActionSubmitResult {
    if (this.sm.getPhase() !== GamePhase.NOCHE) {
      return { ok: false, reason: 'Not accepting actions outside NOCHE' };
    }

    const frozen = frozenActorsForValidation(this.state.actionQueue, action);
    const err = validateNightAction(action, this.state, this.sm.getPhase(), frozen);
    if (err) {
      return { ok: false, reason: formatActionValidationError(err) };
    }

    const actor = this.state.getPlayer(action.actor)!;
    const type = (action.type || '').toLowerCase();

    if (type === 'troll_provoke') {
      const idx = Number(action.meta?.messageIndex ?? 0);
      const message = TROLL_PROVOKE_MESSAGES[idx] ?? TROLL_PROVOKE_MESSAGES[0];
      const entry = buildTrollProvokeLog(message, this.state.nightNumber);
      this.state.publicLogs.push(entry);
      this.emit('publicLog', { roomId: this.id, entry });
      markActionSubmitted(actor, type, undefined, this.state.players.length);
      this.emit('actionAccepted', { roomId: this.id, actionId: action.id });
      recordPlayerAction(this.state.gameStats, action.actor);
      this.emitNightProgress();
      try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving provoke', e); }
      return { ok: true };
    }

    if (type === 'noise_burst') {
      const idx = Number(action.meta?.messageIndex ?? 0);
      const message = WHITE_NOISE_MESSAGES[idx] ?? WHITE_NOISE_MESSAGES[0];
      const entry = buildTrollProvokeLog(`[RUIDO] ${message}`, this.state.nightNumber);
      this.state.publicLogs.push(entry);
      this.emit('publicLog', { roomId: this.id, entry });
      markActionSubmitted(actor, type, undefined, this.state.players.length);
      this.emit('actionAccepted', { roomId: this.id, actionId: action.id });
      recordPlayerAction(this.state.gameStats, action.actor);
      this.emitNightProgress();
      try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving noise_burst', e); }
      return { ok: true };
    }

    const minigameResult = resolveForNightAction(
      action.actor,
      action.meta?.challengeToken,
      action.meta?.challengeAnswer,
    );

    const previous = this.state.actionQueue.find(a => a.actor === action.actor);
    if (previous) {
      revertQueuedActionMetadata(actor, previous.type, previous.target);
    }

    this.state.queueAction({
      ...action,
      meta: { ...action.meta, minigameResult },
    });
    markActionSubmitted(actor, type, action.target, this.state.players.length);

    recordPlayerAction(this.state.gameStats, action.actor);

    this.emit('actionAccepted', { roomId: this.id, actionId: action.id });
    this.emitNightProgress();
    try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on submitAction', e); }
    return { ok: true };
  }

  /** Registra voto diurno; aplica peso DDoS y redirección Phisher. */
  submitVote(voter: string, target: string | null): ActionSubmitResult {
    if (this.sm.getPhase() !== GamePhase.VOTACION) {
      return { ok: false, reason: 'Solo puedes votar durante VOTACION (wrong_phase)' };
    }

    const voterPlayer = this.state.getPlayer(voter);
    if (!voterPlayer || !voterPlayer.isAlive) {
      return { ok: false, reason: 'Votante no encontrado o eliminado (actor_dead)' };
    }
    if (isSilenced(voterPlayer, this.state.dayNumber)) {
      return { ok: false, reason: 'Estás silenciado y no puedes votar (actor_silenced)' };
    }
    if (isVoteBlocked(voterPlayer, this.state.dayNumber)) {
      return { ok: false, reason: 'Tu voto está bloqueado por sabotaje (vote_blocked)' };
    }

    for (const p of this.state.players) {
      const meta = getMeta(p);
      if (meta.patchedVoterId === voter) {
        return { ok: false, reason: 'Tu voto fue anulado por parche de emergencia (vote_patched)' };
      }
    }

    let resolvedTarget = this.state.resolvePhisherRedirect(voter, target);
    resolvedTarget = this.state.applyDnsVoteSpoof(voter, resolvedTarget);

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

    recordVote(this.state.gameStats);

    try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on submitVote', e); }
    return { ok: true };
  }

  private resolveVotes(): import('./voteResolution').VoteResolution {
    const aliveIds = new Set(this.state.getAlivePlayers().map(p => p.id));
    const lastVotes: Record<string, string | null> = {};
    for (const [targetId, voters] of Object.entries(this.state.votes)) {
      for (const voterId of voters) {
        lastVotes[voterId] = targetId === 'skip' ? null : targetId;
      }
    }
    this.state.lastVoteByPlayer = lastVotes;

    const { resolution, events } = computeVoteResolution(this.id, this.state.votes, aliveIds);

    if (events.voteTied) {
      const skipPart = events.voteTied.skipVotes ? ` (skip: ${events.voteTied.skipVotes})` : '';
      if (events.voteTied.reason === 'tie') {
        this.state.log(
          `Vote tied at ${events.voteTied.voteCount} votes${skipPart} — no elimination, proceeding to NOCHE`,
        );
      } else {
        this.state.log(`No elimination votes${skipPart} — proceeding to NOCHE`);
      }
      this.emit('voteTied', events.voteTied);
    }

    let eliminated: string | null = null;
    if (!isVoteTieResult(resolution) && events.eliminatedPlayerId) {
      const bestTarget = events.eliminatedPlayerId;
      const player = this.state.getPlayer(bestTarget);
      if (player?.isAlive) {
        const sabMeta = getMeta(player);
        const saboteurSurvives =
          player.role === RoleName.SABOTEUR &&
          (sabMeta.lynchSurvivorUntilDay ?? 0) >= this.state.dayNumber &&
          !sabMeta.lynchSurvivorConsumed;
        if (saboteurSurvives) {
          sabMeta.lynchSurvivorConsumed = true;
          this.state.log(
            `Saboteur ${bestTarget} survived vote (${resolution.voteCount} votes) — chaos shield consumed`,
          );
        } else {
          player.isAlive = false;
          eliminated = bestTarget;
          this.state.log(
            `Voted out: ${bestTarget} (${resolution.voteCount} votes, skip: ${resolution.skipVotes})`,
          );
          this.emit('playerEliminated', { roomId: this.id, playerId: bestTarget, reason: 'vote' });
          this.applyHoneypotBanDrag(bestTarget);
          this.maybeEndGame({ justVotedOut: bestTarget });
        }
      }
    }

    this.clearVoteChaosEffects();

    return { ...resolution, eliminated };
  }

  private clearVoteChaosEffects() {
    for (const p of this.state.players) {
      const meta = getMeta(p);
      if (meta.phisherRedirects) meta.phisherRedirects = {};
      if ((meta.dnsVoteSpoofUntilDay ?? 0) <= this.state.dayNumber) {
        meta.dnsVoteSpoofUntilDay = undefined;
      }
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
      this.maybeEndGame();
    }
  }

  private maybeEndGame(context: { justVotedOut?: string } = {}): boolean {
    if (this.sm.getPhase() === GamePhase.FIN) return true;
    return this.endGame(checkAnyWin(this.state, context));
  }

  private endGame(result: ReturnType<typeof checkAnyWin>) {
    if (!result.over) return false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    computeMvp(this.state);
    const stats = buildStatsEntries(this.state);
    this.emit('gameStats', { roomId: this.id, stats });

    let winnerLabel = 'Partida terminada';
    if (result.type === 'team') {
      this.state.winner = result.winner;
      winnerLabel = result.winner === Team.SYSTEM ? 'SYSTEM VICTORIOSO' : 'BLACK HAT VICTORIOSO';
      this.state.log(`Game over: ${result.winner} wins`);
      this.sm.transitionTo(GamePhase.FIN);
      this.emit('gameOver', { roomId: this.id, winner: result.winner, soloWinner: null });
    } else {
      this.state.soloWinner = result.solo;
      winnerLabel = `SOLITARIO: ${result.solo.role}`;
      this.state.log(`Game over: solo win ${result.solo.playerId}`);
      this.sm.transitionTo(GamePhase.FIN);
      this.emit('gameOver', { roomId: this.id, winner: null, soloWinner: result.solo });
    }

    const overEntry = buildGameOverLog(winnerLabel);
    this.state.publicLogs.push(overEntry);
    this.emit('publicLog', { roomId: this.id, entry: overEntry });

    try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving on gameOver', e); }
    try { database.archive(this.id, 'finishgame'); } catch (e) { logger.error('Failed archiving on gameOver', e); }
    return true;
  }

  /**
   * Avanza máquina de estados: resuelve noche, votación o verificación de victoria.
   * Retorna fase resultante o null si no hay transición.
   */
  async advancePhase() {
    if (this.sm.getPhase() === GamePhase.FIN) return null;

    const current = this.sm.getPhase();

    if (current === GamePhase.VERIFICACION) {
      if (this.maybeEndGame()) return GamePhase.FIN;
      this.sm.transitionTo(GamePhase.NOCHE);
      return GamePhase.NOCHE;
    }

    // Recupera partidas atascadas (ej. solo Gusano vivo en DIA tras kill nocturna previa).
    if (current !== GamePhase.NOCHE && this.maybeEndGame()) {
      return GamePhase.FIN;
    }

    if (current === GamePhase.NOCHE) {
      const batch: NightActionBatch = { roomId: this.id, phase: GamePhase.NOCHE, actions: this.state.actionQueue };
      const resolution = resolveNightActions(batch, this.state);

      for (const pr of resolution.privateResults) {
        this.emit('privateResult', { roomId: this.id, playerId: pr.playerId, payload: pr.payload });
      }

      this.emit('nightResolved', { roomId: this.id, resolution });
      recordNightStats(this.state.gameStats, resolution);
      this.pushPublicLogs(buildNightPublicLogs(this.state, resolution));
      try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving after nightResolved', e); }

      const winAfterNight = checkAnyWin(this.state);
      if (this.endGame(winAfterNight)) return GamePhase.FIN;

      const nextPhase = this.sm.next();
      if (!nextPhase) return null;

      if (nextPhase === GamePhase.DIA) {
        const eliminated = [...this.state.lastNightKills];
        const report: IncidentReport = {
          roomId: this.id,
          nightNumber: this.state.nightNumber,
          eliminatedPlayerIds: eliminated,
          disconnected: eliminated,
        };
        this.emit('incidentReport', report);
      }
      return nextPhase;
    }

    if (current === GamePhase.VOTACION) {
      const voteResult = this.resolveVotes();
      if (this.sm.getPhase() === GamePhase.FIN) return GamePhase.FIN;
      try { database.save(this.id, this.state.toPlain()); } catch (e) { logger.error('Failed saving after resolveVotes', e); }

      if (voteResult.tied) {
        if (voteResult.eliminated != null) {
          logger.warn('[Room] vote tie had eliminated id — ignoring', {
            roomId: this.id,
            eliminated: voteResult.eliminated,
          });
        }
        const voteLog = buildVoteLog(null, voteResult.voteCount, this.state.dayNumber);
        this.state.publicLogs.push(voteLog);
        this.emit('publicLog', { roomId: this.id, entry: voteLog });
        this.sm.transitionTo(GamePhase.NOCHE);
        return GamePhase.NOCHE;
      }

      const voteLog = buildVoteLog(voteResult.eliminated ?? null, voteResult.voteCount, this.state.dayNumber);
      this.state.publicLogs.push(voteLog);
      this.emit('publicLog', { roomId: this.id, entry: voteLog });

      const soloAfterVote = checkAnyWin(this.state, { justVotedOut: voteResult.eliminated ?? undefined });
      if (this.endGame(soloAfterVote)) return GamePhase.FIN;

      if (this.maybeEndGame()) return GamePhase.FIN;

      // Victoria ya comprobada arriba — sin fase VERIFICACION visible que bloquee animaciones.
      this.sm.transitionTo(GamePhase.NOCHE);
      return GamePhase.NOCHE;
    }

    const nextPhase = this.sm.next();
    if (!nextPhase) return null;

    return nextPhase;
  }

  schedulePhaseTimeout(phase: GamePhase) {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const cfg = this.state.phaseConfig;
    if (!cfg.autoAdvance) return;
    let ms = 0;
    if (phase === GamePhase.NOCHE) ms = cfg.nightDurationMs;
    if (phase === GamePhase.DIA) ms = cfg.dayDurationMs;
    if (phase === GamePhase.VOTACION) ms = cfg.voteDurationMs;
    if (phase === GamePhase.VERIFICACION) ms = verificationPhaseDurationMs();
    if (ms > 0) {
      this.state.phaseEndsAt = Date.now() + ms;
      this.timer = setTimeout(() => { void this.advancePhase(); }, ms);
    }
  }

  destroy() {
    if (this.timer) clearTimeout(this.timer);
    this.removeAllListeners();
  }
}

export default Room;
