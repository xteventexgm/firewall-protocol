/**
 * Bots de QA: acciones nocturnas, votos y auto-avance hasta FIN.
 * Ritmo de partida real: respeta phaseConfig (timers del lobby) y autoAdvance de Room.
 */
import { randomUUID } from 'crypto';
import Room from './Room';
import { Player } from '../models/PlayerProfile';
import { GamePhase } from '../types';
import { ROLE_NIGHT_ACTIONS } from '../types/player-metadata.types';
import { RoleName, Team } from '../types/roles.types';
import { devBotsEnabled } from '../config/env';
import { MIN_PLAYERS } from '../utils/constants';
import { getMeta, isSilenced } from './playerMetadata';
import { isInfected } from './infection';
import { buildBotQaLog } from './PublicLogService';
import { logger } from '../utils/logger';
import { TROLL_PROVOKE_MESSAGES } from './trollProvoke';
import { WHITE_NOISE_MESSAGES } from './whiteNoise';
import {
  pickHackerConsensusTarget,
  pickInfectTarget,
  pickOffensiveNightTarget,
  pickProtectTarget,
  pickVoteTarget,
} from './BotBrain';

const hackerVoteTargetByRoom = new Map<string, string | null>();
const attachedRooms = new WeakSet<Room>();

/** Duración VERIFICACION antes de pasar a NOCHE (auto-avance). Breve: solo comprobación de victoria. */
const VERIFICATION_PHASE_MS = 1_500;

function aliveOthers(room: Room, actorId: string): Player[] {
  return room.state.getAlivePlayers().filter((p) => p.id !== actorId);
}

function pickRandom<T>(arr: T[]): T | undefined {
  if (!arr.length) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

function playerLabel(room: Room, id: string | null | undefined): string {
  if (!id) return '—';
  return room.state.getPlayer(id)?.name ?? id.slice(0, 8);
}

function phaseDurationMs(room: Room, phase: GamePhase): number {
  const cfg = room.state.phaseConfig;
  if (phase === GamePhase.NOCHE) return cfg.nightDurationMs;
  if (phase === GamePhase.DIA) return cfg.dayDurationMs;
  if (phase === GamePhase.VOTACION) return cfg.voteDurationMs;
  return 30_000;
}

/** Espacia acciones de bots a lo largo del timer de fase (mín. 1 s entre bots). */
function botActionSpacingMs(room: Room, phase: GamePhase, botCount: number): number {
  if (botCount <= 0) return 0;
  const windowMs = phaseDurationMs(room, phase) * 0.75;
  return Math.max(1_000, Math.floor(windowMs / botCount));
}

export function isBotQaAutoRunActive(room: Room): boolean {
  if (!devBotsEnabled()) return false;
  if (room.state.phaseConfig.botQaAutoRun) return true;
  const players = room.state.players;
  return players.length > 0 && players.every((p) => p.isBot);
}

function logQaGameOver(room: Room): void {
  if (room.state.soloWinner) {
    const s = room.state.soloWinner;
    logBotAction(
      room,
      `Partida QA terminada — victoria solitaria: ${s.role} (${playerLabel(room, s.playerId)})`,
      'success',
    );
  } else if (room.state.winner) {
    logBotAction(room, `Partida QA terminada — bando: ${room.state.winner}`, 'success');
  } else {
    logBotAction(room, 'Partida QA terminada', 'success');
  }
}

export function attachBotController(room: Room): void {
  if (!devBotsEnabled() || attachedRooms.has(room)) return;
  attachedRooms.add(room);

  room.on('phaseChanged', ({ to }: { to: GamePhase }) => {
    setTimeout(() => {
      if (to === GamePhase.NOCHE) {
        hackerVoteTargetByRoom.set(room.id, null);
        runBotNightActions(room);
      } else if (to === GamePhase.VOTACION) {
        runBotVotes(room);
      }

      if (to === GamePhase.FIN && isBotQaAutoRunActive(room)) {
        logQaGameOver(room);
      }
    }, 1_200);
  });

  room.on('gameOver', () => {
    /* noop — FIN vía phaseChanged */
  });
}

/** Crea bots, activa auto-run respetando timers del lobby e inicia partida. */
export function runBotQaMatch(room: Room): void {
  if (!devBotsEnabled()) {
    throw new Error('Bots desactivados (DEV_BOTS=false)');
  }
  if (room.state.phase !== GamePhase.LOBBY) {
    throw new Error('Solo se puede lanzar partida QA desde LOBBY');
  }

  fillBotsToCapacity(room, { instant: true });
  room.setPhaseConfig({
    ...room.state.phaseConfig,
    autoAdvance: true,
    botQaAutoRun: true,
  });
  room.startGame();

  const cfg = room.state.phaseConfig;
  const entry = buildBotQaLog(
    `Partida QA iniciada — ${room.state.players.length} nodos. Timers: día ${Math.round(cfg.dayDurationMs / 1000)}s, noche ${Math.round(cfg.nightDurationMs / 1000)}s, voto ${Math.round(cfg.voteDurationMs / 1000)}s`,
    'success',
  );
  room.state.publicLogs.push(entry);
  room.emit('publicLog', { roomId: room.id, entry });
  logger.info('[BotController] runBotQaMatch', {
    roomId: room.id,
    players: room.state.players.length,
    dayMs: cfg.dayDurationMs,
    nightMs: cfg.nightDurationMs,
    voteMs: cfg.voteDurationMs,
  });
}

export function createBotPlayer(index: number): Player {
  const id = `bot-${randomUUID().slice(0, 8)}`;
  const name = `BOT-${String(index).padStart(2, '0')}`;
  const p = new Player(id, name);
  p.isBot = true;
  p.isConnected = true;
  return p;
}

function slotsUntilFull(room: Room): number {
  return Math.max(0, room.state.maxPlayers - room.state.players.length);
}

export function hasHumanPlayer(room: Room): boolean {
  return room.state.players.some((p) => !p.isBot);
}

/** Añade un bot en LOBBY (solo si hay al menos un jugador real). */
export function addOneBot(room: Room): number {
  if (!devBotsEnabled()) {
    throw new Error('Bots desactivados (DEV_BOTS=false)');
  }
  if (room.state.phase !== GamePhase.LOBBY) {
    throw new Error('Solo se pueden añadir bots en LOBBY');
  }
  if (!hasHumanPlayer(room)) {
    throw new Error('Debe haber al menos un jugador real en la sala antes de añadir bots');
  }
  if (room.state.players.length >= room.state.maxPlayers) {
    return 0;
  }

  const existingBots = room.state.players.filter((p) => p.isBot).length;
  const bot = createBotPlayer(existingBots + 1);
  room.addPlayer(bot);

  const entry = buildBotQaLog(
    `Nodo bot conectado: ${bot.name} — ${room.state.players.length}/${room.state.maxPlayers}`,
    'info',
  );
  room.state.publicLogs.push(entry);
  room.emit('publicLog', { roomId: room.id, entry });
  logger.info('[BotController] addOneBot', {
    roomId: room.id,
    bot: bot.name,
    total: room.state.players.length,
  });
  return 1;
}

export function fillBotsToCapacity(room: Room, opts?: { instant?: boolean }): number {
  if (!devBotsEnabled()) {
    throw new Error('Bots desactivados (DEV_BOTS=false)');
  }
  if (room.state.phase !== GamePhase.LOBBY) {
    throw new Error('Solo se pueden añadir bots en LOBBY');
  }
  if (!opts?.instant) {
    throw new Error('Relleno masivo de bots solo disponible en partida QA automática');
  }
  return fillBotsInstant(room, slotsUntilFull(room));
}

/** Relleno inmediato (solo partida QA headless / automática). */
function fillBotsInstant(room: Room, count: number): number {
  if (count <= 0) return 0;
  let added = 0;
  const existingBots = room.state.players.filter((p) => p.isBot).length;
  for (let i = 0; i < count; i++) {
    if (room.state.players.length >= room.state.maxPlayers) break;
    const bot = createBotPlayer(existingBots + added + 1);
    room.addPlayer(bot);
    added++;
  }
  if (added > 0) {
    const entry = buildBotQaLog(
      `${added} nodo(s) bot añadido(s) — total ${room.state.players.length}/${room.state.maxPlayers}`,
      'success',
    );
    room.state.publicLogs.push(entry);
    room.emit('publicLog', { roomId: room.id, entry });
    logger.info('[BotController] fillBotsInstant', { roomId: room.id, added, total: room.state.players.length });
  }
  return added;
}

export function fillBots(room: Room, count: number): number {
  if (count <= 0) return 0;
  let added = 0;
  for (let i = 0; i < count; i++) {
    added += addOneBot(room);
    if (room.state.players.length >= room.state.maxPlayers) break;
  }
  return added;
}

export function clearBots(room: Room): number {
  if (room.state.phase !== GamePhase.LOBBY) {
    throw new Error('Solo se pueden quitar bots en LOBBY');
  }
  const bots = room.state.players.filter((p) => p.isBot);
  for (const b of bots) {
    room.removePlayer(b.id);
  }
  if (bots.length > 0) {
    const entry = buildBotQaLog(`${bots.length} bot(s) eliminado(s) de la sala`, 'info');
    room.state.publicLogs.push(entry);
    room.emit('publicLog', { roomId: room.id, entry });
  }
  return bots.length;
}

function logBotAction(room: Room, message: string, severity: 'info' | 'warn' | 'success' = 'info'): void {
  const entry = buildBotQaLog(message, severity);
  room.state.publicLogs.push(entry);
  room.emit('publicLog', { roomId: room.id, entry });
  logger.info('[BotController]', { roomId: room.id, message });
}

function runBotNightActions(room: Room): void {
  if (room.state.phase !== GamePhase.NOCHE) return;

  const bots = room.state.players.filter((p) => p.isBot && p.isAlive && p.role);
  const spacing = botActionSpacingMs(room, GamePhase.NOCHE, bots.length);
  let delay = spacing;
  let scheduled = 0;

  for (const bot of bots) {
    if (isSilenced(bot, room.state.dayNumber)) {
      logBotAction(room, `${bot.name}: silenciado — sin acción nocturna`, 'warn');
      continue;
    }

    const meta = getMeta(bot);
    if (meta.actedThisNight) continue;

    scheduled += 1;
    setTimeout(() => {
      if (room.state.phase !== GamePhase.NOCHE) return;

      const action = buildBotNightAction(room, bot);
      if (!action) {
        logBotAction(room, `${bot.name} (${bot.role}): sin acción disponible`, 'info');
        return;
      }
      const result = room.submitAction(action);
      const targetId = typeof action.target === 'string' ? action.target : null;
      const targetLabel = playerLabel(room, targetId);
      if (result.ok) {
        logger.info('[BotController] night action', {
          roomId: room.id,
          bot: bot.name,
          role: bot.role,
          type: action.type,
          target: targetLabel,
        });
      } else {
        logBotAction(
          room,
          `${bot.name} (${bot.role}): ${action.type} falló — ${result.reason}`,
          'warn',
        );
      }
    }, delay);
    delay += spacing;
  }

  if (scheduled > 0) {
    logger.info('[BotController] night actions scheduled', {
      roomId: room.id,
      count: scheduled,
      spacingMs: spacing,
    });
  }
}

function buildBotNightAction(room: Room, bot: Player): Record<string, unknown> | null {
  const role = bot.role as RoleName;
  const allowed = ROLE_NIGHT_ACTIONS[role] ?? [];
  if (!allowed.length) return null;

  let type = allowed[0];
  if (role === RoleName.WORM && allowed.includes('worm_infect')) {
    type = 'worm_infect';
  }
  if (role === RoleName.ANTIVIRUS && allowed.includes('cure')) {
    const infected = aliveOthers(room, bot.id).find((p) => isInfected(p));
    if (infected) type = 'cure';
  }
  if (role === RoleName.CRYPTO_MINER && allowed.includes('mine_crypto')) {
    type = 'mine_crypto';
  }
  if (role === RoleName.DROPPER && allowed.includes('rigged_payload')) {
    type = 'rigged_payload';
  }
  if (role === RoleName.SABOTEUR && allowed.includes('jam_hacker')) {
    type = 'jam_hacker';
  }
  if (role === RoleName.MIRAGE && allowed.includes('mirage_cloak')) {
    type = 'mirage_cloak';
  }

  const base = {
    id: `bot_act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    actor: bot.id,
    role,
    type,
    timestamp: Date.now(),
  };

  if (type === 'troll_provoke' || type === 'noise_burst') {
    const pool = type === 'noise_burst' ? WHITE_NOISE_MESSAGES : TROLL_PROVOKE_MESSAGES;
    return {
      ...base,
      meta: { messageIndex: Math.floor(Math.random() * pool.length) },
    };
  }

  if (type === 'mirage_cloak') {
    return { ...base };
  }

  if (type === 'jam_hacker') {
    return { ...base };
  }

  if (type === 'intel_pulse') {
    return { ...base };
  }

  if (type === 'hacker_vote') {
    let target = hackerVoteTargetByRoom.get(room.id);
    if (!target) {
      target = pickHackerConsensusTarget(room, bot.id);
      if (target) hackerVoteTargetByRoom.set(room.id, target);
    }
    if (!target) return null;
    return { ...base, target };
  }

  if (type === 'bgp_swap') {
    const others = aliveOthers(room, bot.id);
    const a = pickRandom(others);
    const b = pickRandom(others.filter((p) => p.id !== a?.id));
    if (!a || !b) return null;
    return { ...base, target: a.id, meta: { swapWith: b.id } };
  }

  if (type === 'chaos_route') {
    const others = aliveOthers(room, bot.id);
    const origin = pickRandom(others);
    const collateral = pickRandom(others.filter((p) => p.id !== origin?.id));
    if (!origin || !collateral) return null;
    return { ...base, target: origin.id, meta: { routeTo: collateral.id } };
  }

  if (type === 'phisher_redirect') {
    const victim = pickOffensiveNightTarget(room, bot);
    const redirectTo = pickRandom(
      aliveOthers(room, bot.id).filter((p) => p.id !== victim),
    );
    if (!victim || !redirectTo) return null;
    return { ...base, target: victim, meta: { redirectTo: redirectTo.id } };
  }

  if (type === 'mitm_hijack') {
    const hackers = aliveOthers(room, bot.id).filter((p) => p.team === Team.BLACK_HAT);
    const hacker = pickRandom(hackers);
    const hijackTo = pickOffensiveNightTarget(room, bot);
    if (!hacker || !hijackTo || hijackTo === hacker.id) return null;
    return { ...base, target: hacker.id, meta: { hijackTo } };
  }

  if (type === 'zero_day_assume') {
    const dead = room.state.players.filter((p) => !p.isAlive && p.role);
    const target = pickRandom(dead);
    if (!target) return null;
    return { ...base, target: target.id };
  }

  if (type === 'worm_infect') {
    const target = pickInfectTarget(room, bot.id);
    if (!target) return null;
    return { ...base, target };
  }

  if (type === 'protect' || type === 'cure') {
    const target =
      type === 'cure'
        ? aliveOthers(room, bot.id).find((p) => isInfected(p))?.id
        : pickProtectTarget(room, bot);
    if (!target) return null;
    return { ...base, target };
  }

  if (
    type === 'pentester_kill' ||
    type === 'brute_force' ||
    type === 'ransomware' ||
    type === 'worm_kill' ||
    type === 'scan' ||
    type === 'spy' ||
    type === 'team_probe' ||
    type === 'ids_watch' ||
    type === 'patch_harden' ||
    type === 'exploit_strip' ||
    type === 'shadow_mask' ||
    type === 'logic_bomb' ||
    type === 'data_leak' ||
    type === 'forensic_trace' ||
    type === 'backup_mark' ||
    type === 'threat_hunt' ||
    type === 'incident_clear' ||
    type === 'waf_block' ||
    type === 'backdoor_plant' ||
    type === 'lateral_probe' ||
    type === 'vote_trace' ||
    type === 'vuln_scan' ||
    type === 'cred_probe' ||
    type === 'dns_spoof' ||
    type === 'rigged_payload' ||
    type === 'ransom_note' ||
    type === 'honeypot_drag' ||
    type === 'crypto_bribe'
  ) {
    const target = pickOffensiveNightTarget(room, bot);
    if (!target) return null;
    return { ...base, target };
  }

  if (type === 'mine_crypto') {
    const target = pickRandom(aliveOthers(room, bot.id))?.id;
    if (!target) return null;
    return { ...base, target };
  }

  if (type === 'freeze') {
    const target = pickOffensiveNightTarget(room, bot);
    if (!target) return null;
    return { ...base, target };
  }

  const target = pickOffensiveNightTarget(room, bot);
  if (!target) return null;
  return { ...base, target };
}

function runBotVotes(room: Room): void {
  if (room.state.phase !== GamePhase.VOTACION) return;

  const bots = room.state.players.filter((p) => p.isBot && p.isAlive);
  const spacing = botActionSpacingMs(room, GamePhase.VOTACION, bots.length);

  const firstHacker = bots.find((b) => b.team === Team.BLACK_HAT);
  const consensusTarget = firstHacker ? pickHackerConsensusTarget(room, firstHacker.id) : null;
  if (consensusTarget) {
    hackerVoteTargetByRoom.set(room.id, consensusTarget);
  }

  let delay = spacing;
  let scheduled = 0;

  for (const bot of bots) {
    if (isSilenced(bot, room.state.dayNumber)) continue;

    scheduled += 1;
    setTimeout(() => {
      if (room.state.phase !== GamePhase.VOTACION) return;

      let target: string | null = null;
      if (bot.team === Team.BLACK_HAT) {
        target = hackerVoteTargetByRoom.get(room.id) ?? consensusTarget;
      } else {
        target = pickVoteTarget(room, bot);
      }

      const result = room.submitVote(bot.id, target);
      const label = target ? playerLabel(room, target) : 'abstención';
      if (result.ok) {
        logger.info('[BotController] vote', { roomId: room.id, bot: bot.name, target: label });
      } else {
        logBotAction(room, `${bot.name} no pudo votar — ${result.reason}`, 'warn');
      }
    }, delay);
    delay += spacing;
  }

  if (scheduled > 0) {
    logBotAction(
      room,
      `Votación: ${scheduled} bot(s) votarán durante la fase (${Math.round(spacing / 1000)}s entre votos)`,
      'info',
    );
  }
}

/** Usado por Room.schedulePhaseTimeout para VERIFICACION. */
export function verificationPhaseDurationMs(): number {
  return VERIFICATION_PHASE_MS;
}
