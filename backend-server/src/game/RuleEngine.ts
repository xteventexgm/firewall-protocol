/**
 * Motor de resolución nocturna por fases (regla de oro estilo Mafia/Werewolf).
 *
 * Fases de `resolveNightActions`:
 * 0. Preparación — BGP, Deep Freeze, Honeypot, Phisher
 * 1. Protecciones — Antivirus protect/cure
 * 2. Ataques — infecciones maduras, consenso hacker, Pentester, Gusano, Ransomware
 * 3. Investigaciones — SOC scan, Spyware, Zero-Day assume
 *
 * Balance detallado: ver `balance.ts` y comentarios en `tryKill` / `scanResult`.
 */
import { NightActionBatch, NightResolution, PlayerAction, ScanResult } from '../types/events.types';
import { GameStateModel } from '../models/GameState';
import { Player } from '../models/PlayerProfile';
import { ROLE_CATALOG, RoleName, Team } from '../types/roles.types';
import { getMeta } from './playerMetadata';
import { applyZeroDayAssume, countFactionAlive } from './VictoryChecker';
import { buildRoleAssignedPayload } from './roleInfo';
import { collectFrozenActors } from './nightFreeze';
import {
  applyInfection,
  clearInfection,
  getInfection,
  isInfected,
  isInfectionMature,
  infectionSourceLabel,
} from './infection';
import { MINER_MAX_SHIELDS, CHAOS_DROPER_MAX_SHIELDS } from './balance';

function actionType(a: PlayerAction) {
  return (a.type || '').toLowerCase();
}

function isActorBlocked(a: PlayerAction, frozenActors: Set<string>, res: NightResolution) {
  if (frozenActors.has(a.actor)) {
    res.prevented.push({ actionId: a.id, reason: 'actor_frozen' });
    res.logs.push(`Action ${actionType(a)} by ${a.actor} annulled: frozen by Deep Freeze`);
    return true;
  }
  return false;
}

function resolveHackerConsensus(
  actions: PlayerAction[],
  state: GameStateModel,
  frozenActors: Set<string>,
  playersById: Map<string, Player>,
): string | null {
  const hackerVotes = new Map<string, number>();
  const aliveHackers = new Set(
    state.players.filter(p => p.isAlive && p.team === Team.BLACK_HAT).map(p => p.id),
  );

  const mitmOverrides = new Map<string, string>();
  for (const a of actions) {
    if (actionType(a) !== 'mitm_hijack' || !a.target || !a.meta?.hijackTo) continue;
    if (frozenActors.has(a.actor)) continue;
    mitmOverrides.set(a.target, a.meta.hijackTo);
  }

  for (const a of actions) {
    if (actionType(a) !== 'hacker_vote' || !a.target) continue;
    if (!aliveHackers.has(a.actor)) continue;
    if (frozenActors.has(a.actor)) continue;
    const voteTarget = mitmOverrides.get(a.actor) ?? a.target;
    const weight = playersById.get(a.actor)?.role === RoleName.DDOS ? 2 : 1;
    hackerVotes.set(voteTarget, (hackerVotes.get(voteTarget) || 0) + weight);
  }

  for (const p of state.players) {
    if (!p.isAlive) continue;
    if (getMeta(p).backdoorBonusTonight) {
      hackerVotes.set(p.id, (hackerVotes.get(p.id) || 0) + 1);
    }
  }

  if (hackerVotes.size === 0) return null;

  const hackerCount = aliveHackers.size;
  let best: string | null = null;
  let bestCount = 0;
  for (const [target, count] of hackerVotes) {
    if (count > bestCount) {
      bestCount = count;
      best = target;
    }
  }

  if (best && bestCount > hackerCount / 2) return best;
  return null;
}

function scanResult(target: Player | undefined, nightNumber: number): ScanResult {
  if (!target?.role) return 'safe';
  const meta = getMeta(target);
  if (meta.scanMaskedUntilNight === nightNumber) return 'safe';
  const targetRole = target.role as RoleName;
  if (targetRole === RoleName.ROOTKIT) return 'safe';
  const team = ROLE_CATALOG[targetRole].team;
  if (team === Team.SYSTEM) return 'safe';
  if (team === Team.CHAOTIC) return 'suspicious';
  return 'malicious';
}

function isConsensusBlocked(target: Player, nightNumber: number): boolean {
  return (getMeta(target).consensusBlockedUntilNight ?? 0) >= nightNumber;
}

const CREDENTIAL_CRITICAL_ROLES = new Set<RoleName>([
  RoleName.SYSADMIN,
  RoleName.ANTIVIRUS,
  RoleName.SOC_ANALYST,
  RoleName.PATCH_MANAGER,
  RoleName.IDS,
  RoleName.BACKUP_NODE,
]);

function isThreatScan(result: ScanResult): boolean {
  return result === 'malicious' || result === 'suspicious';
}

const HOSTILE_ACTIVITIES = new Set([
  'campaña coordinada',
  'exploit autorizado',
  'fuerza bruta',
  'propagación',
  'cifrado operativo',
  'soborno cripto',
]);

const ACTIVITY_LABELS: Record<string, string> = {
  scan: 'correlación SOC',
  protect: 'protección EDR',
  cure: 'remediación',
  pentester_kill: 'exploit autorizado',
  worm_infect: 'propagación',
  worm_kill: 'propagación',
  ransomware: 'cifrado operativo',
  hacker_consensus: 'campaña coordinada',
  brute_force: 'fuerza bruta',
  spy: 'interceptación',
  freeze: 'aislamiento',
  honeypot_drag: 'señuelo',
  phisher_redirect: 'engaño social',
  zero_day_assume: 'exploit 0-day',
  mine_crypto: 'cryptojacking',
  crypto_bribe: 'soborno cripto',
  ids_watch: 'vigilancia IDS',
  patch_harden: 'parche de endurecimiento',
  exploit_strip: 'stripping EDR',
  shadow_mask: 'enmascaramiento',
  logic_bomb: 'bomba lógica',
  data_leak: 'filtración de datos',
  team_probe: 'sondeo de tráfico',
  forensic_trace: 'análisis forense',
  backup_mark: 'snapshot de respaldo',
  waf_block: 'filtrado WAF',
  backdoor_plant: 'implante backdoor',
  dns_spoof: 'envenenamiento DNS',
  rigged_payload: 'carga manipulada',
  jam_hacker: 'interferencia de consenso',
  chaos_route: 'desvío caótico',
  ally_verify: 'verificación de aliado',
  mitm_hijack: 'secuestro MitM',
};

function activityLabel(actionType: string): string {
  return ACTIVITY_LABELS[actionType] ?? 'actividad de red';
}

type KillOptions = {
  bypassProtection?: boolean;
  bypassMinerShield?: boolean;
};

function isRiggedPayload(target: Player, nightNumber: number): boolean {
  return (getMeta(target).riggedPayloadUntilNight ?? 0) === nightNumber;
}

function tryKill(
  targetId: string,
  state: GameStateModel,
  res: NightResolution,
  reason: string,
  protections: Set<string>,
  opts: KillOptions = {},
): boolean {
  const target = state.getPlayer(targetId);
  if (!target?.isAlive) return false;

  const meta = getMeta(target);
  const rigged = isRiggedPayload(target, state.nightNumber);

  if (!opts.bypassProtection && !rigged && protections.has(targetId)) {
    res.logs.push(`Kill on ${targetId} prevented by EDR protection`);
    return false;
  }

  if (!rigged && meta.backupSaveTonight) {
    meta.backupSaveTonight = false;
    res.logs.push(`Kill on ${targetId} prevented by backup snapshot`);
    return false;
  }

  if (target.role === RoleName.WORM && meta.isWormImmune) {
    meta.isWormImmune = false;
    res.logs.push(`Kill on ${targetId} prevented: first-strike immunity consumed`);
    return false;
  }

  if (
    !opts.bypassMinerShield &&
    target.role === RoleName.CRYPTO_MINER &&
    (meta.shieldCharges ?? 0) > 0
  ) {
    meta.shieldCharges = (meta.shieldCharges ?? 0) - 1;
    res.logs.push(`${targetId} blocked direct attack (shield absorbed, ${meta.shieldCharges} remaining)`);
    return false;
  }

  if (
    !opts.bypassMinerShield &&
    target.role === RoleName.DROPPER &&
    (meta.chaosShieldCharges ?? 0) > 0
  ) {
    meta.chaosShieldCharges = (meta.chaosShieldCharges ?? 0) - 1;
    res.logs.push(
      `${targetId} blocked direct attack (chaos shield absorbed, ${meta.chaosShieldCharges} remaining)`,
    );
    return false;
  }

  target.isAlive = false;
  res.kills.push(targetId);
  res.logs.push(`${targetId} killed: ${reason}`);
  return true;
}

function processMatureInfections(
  state: GameStateModel,
  res: NightResolution,
  protections: Set<string>,
) {
  const currentNight = state.nightNumber;

  for (const player of state.players) {
    if (!player.isAlive) continue;
    const infection = getInfection(player);
    if (!infection || !isInfectionMature(infection, currentNight)) continue;

    res.privateResults.push({
      playerId: player.id,
      payload: {
        type: 'infection_warning',
        targetId: player.id,
        infectionSource: infection.source,
        maturesAfterNight: currentNight,
        critical: true,
      },
    });

    if (tryKill(player.id, state, res, `infection from ${infectionSourceLabel(infection)}`, protections, {
      bypassProtection: true,
      bypassMinerShield: true,
    })) {
      res.infectionKills.push(player.id);
      clearInfection(player);
      processHoneypotDrag(player.id, state, res, protections);
    } else {
      clearInfection(player);
      res.logs.push(`Infection on ${player.id} cleared without death (blocked or already dead)`);
    }
  }
}
function processHoneypotDrag(
  deadId: string,
  state: GameStateModel,
  res: NightResolution,
  protections: Set<string>,
) {
  const dead = state.getPlayer(deadId);
  if (dead?.role !== RoleName.HONEYPOT) return;
  const dragTarget = getMeta(dead).honeypotDragTarget;
  if (!dragTarget) return;
  if (tryKill(dragTarget, state, res, `honeypot drag from ${deadId}`, protections, {
    bypassProtection: true,
  })) {
    res.honeypotDrags.push({ honeypotId: deadId, draggedId: dragTarget });
  }
}

/**
 * Resolución nocturna en fases estrictas (regla de oro Mafia/Werewolf):
 * 0. Preparación — redirecciones, congelado, marcas (BGP, Deep Freeze, Honeypot, Phisher)
 * 1. Protecciones — Antivirus
 * 2. Ataques — consenso hacker, Pentester, Gusano, Ransomware
 * 3. Investigaciones — Analista SOC (scan), Spyware (spy), Zero-Day
 */
/** Resuelve batch nocturno en fases 0→3; retorna kills, scans y efectos para `nightResolved`. */
export function resolveNightActions(batch: NightActionBatch, state: GameStateModel): NightResolution {
  const res: NightResolution = {
    kills: [],
    prevented: [],
    redirects: [],
    logs: [],
    privateResults: [],
    silenced: [],
    honeypotDrags: [],
    infections: [],
    cures: [],
    infectionKills: [],
    publicLeaks: [],
    publicAnnouncements: [],
  };

  const playersById = new Map(state.players.map(p => [p.id, p]));
  const protections = new Set<string>();
  const frozenTargets = new Set<string>();
  const swapMap = new Map<string, string>();
  const chaosRedirectMap = new Map<string, string>();
  const visitLog = new Map<string, { playerId: string; activity: string }[]>();

  const actions = batch.actions.slice();

  const resolveTarget = (targetId: string): string => {
    let t = targetId;
    const visited = new Set<string>();
    while (swapMap.has(t) && !visited.has(t)) {
      visited.add(t);
      const next = swapMap.get(t)!;
      res.redirects.push({ actionId: 'bgp', from: targetId, to: next });
      t = next;
    }
    if (chaosRedirectMap.has(t)) {
      const collateral = chaosRedirectMap.get(t)!;
      res.redirects.push({ actionId: 'chaos_route', from: t, to: collateral });
      t = collateral;
    }
    return t;
  };

  const recordVisit = (visitor: string, target: string, activity?: string) => {
    const list = visitLog.get(target) || [];
    list.push({ playerId: visitor, activity: activity ?? activityLabel('unknown') });
    visitLog.set(target, list);
  };

  // ── Fase 0: preparación — BGP primero, luego freeze (con swap aplicado) ──
  for (const a of actions) {
    const type = actionType(a);
    if (type === 'bgp_swap' && a.target && a.meta?.swapWith) {
      swapMap.set(a.target, a.meta.swapWith);
      swapMap.set(a.meta.swapWith, a.target);
      res.logs.push(`BGP swap ${a.target} <-> ${a.meta.swapWith}`);
    } else if (type === 'chaos_route' && a.target && a.meta?.routeTo) {
      chaosRedirectMap.set(a.target, a.meta.routeTo);
      res.logs.push(`Chaos route ${a.target} -> ${a.meta.routeTo}`);
    }
  }

  for (const id of collectFrozenActors(actions, swapMap)) {
    frozenTargets.add(id);
    res.logs.push(`Deep Freeze on ${id} — night actions annulled`);
  }

  // Saboteador: jam propio (máscara SOC + inmunidad a consenso + escudo de linchamiento).
  for (const a of actions) {
    if (actionType(a) !== 'jam_hacker') continue;
    if (frozenTargets.has(a.actor)) continue;
    const actor = playersById.get(a.actor);
    if (!actor?.isAlive) continue;
    const meta = getMeta(actor);
    meta.scanMaskedUntilNight = state.nightNumber;
    meta.consensusBlockedUntilNight = state.nightNumber;
    meta.lynchSurvivorUntilDay = state.dayNumber + 1;
    meta.lynchSurvivorConsumed = false;
    res.logs.push(
      `Saboteur ${a.actor} jammed own signal — SOC masked, consensus-immune, lynch shield armed`,
    );
  }

  for (const a of actions) {
    const type = actionType(a);
    if (type === 'honeypot_drag' && a.target) {
      if (isActorBlocked(a, frozenTargets, res)) continue;
      const actor = playersById.get(a.actor);
      if (actor) getMeta(actor).honeypotDragTarget = a.target;
    } else if (type === 'phisher_redirect' && a.target && a.meta?.redirectTo) {
      if (isActorBlocked(a, frozenTargets, res)) continue;
      const actor = playersById.get(a.actor);
      if (actor) {
        const meta = getMeta(actor);
        if (!meta.phisherRedirects) meta.phisherRedirects = {};
        meta.phisherRedirects[a.target] = a.meta.redirectTo;
        res.logs.push(`Social-engineering redirect ${a.target} -> ${a.meta.redirectTo}`);
      }
    } else if (type === 'patch_harden' && a.target) {
      if (isActorBlocked(a, frozenTargets, res)) continue;
      const target = playersById.get(resolveTarget(a.target));
      if (target?.isAlive) {
        getMeta(target).consensusBlockedUntilNight = state.nightNumber;
        res.logs.push(`Hardening patch on ${target.id} blocks hacker consensus this night`);
      }
    } else if (type === 'exploit_strip' && a.target) {
      if (isActorBlocked(a, frozenTargets, res)) continue;
      const target = playersById.get(resolveTarget(a.target));
      if (target?.isAlive) {
        getMeta(target).exploitStrippedUntilNight = state.nightNumber;
        res.logs.push(`Exploit kit stripped EDR on ${target.id} for this night`);
      }
    } else if (type === 'shadow_mask' && a.target) {
      if (isActorBlocked(a, frozenTargets, res)) continue;
      const target = playersById.get(resolveTarget(a.target));
      if (target?.isAlive) {
        getMeta(target).scanMaskedUntilNight = state.nightNumber;
        res.logs.push(`Shadow mask applied to ${target.id} for SOC scans`);
      }
    } else if (type === 'logic_bomb' && a.target) {
      if (isActorBlocked(a, frozenTargets, res)) continue;
      const target = playersById.get(resolveTarget(a.target));
      if (target?.isAlive) {
        getMeta(target).logicBombArmed = true;
        res.logs.push(`Logic bomb armed on ${target.id} (detonates if acts next night)`);
      }
    } else if (type === 'ids_watch' && a.target) {
      if (isActorBlocked(a, frozenTargets, res)) continue;
      const actor = playersById.get(a.actor);
      if (actor) {
        getMeta(actor).idsWatchTarget = resolveTarget(a.target);
        res.logs.push(`IDS watch on ${a.target}`);
      }
    } else if (type === 'backup_mark' && a.target) {
      if (isActorBlocked(a, frozenTargets, res)) continue;
      const target = playersById.get(resolveTarget(a.target));
      if (target?.isAlive) {
        getMeta(target).backupSaveTonight = true;
        res.logs.push(`Backup snapshot armed on ${target.id}`);
      }
    } else if (type === 'waf_block' && a.target) {
      if (isActorBlocked(a, frozenTargets, res)) continue;
      const target = playersById.get(resolveTarget(a.target));
      if (target?.isAlive) {
        getMeta(target).wormBlockedUntilNight = state.nightNumber;
        res.logs.push(`WAF blocked worm propagation on ${target.id}`);
      }
    } else if (type === 'backdoor_plant' && a.target) {
      if (isActorBlocked(a, frozenTargets, res)) continue;
      const target = playersById.get(resolveTarget(a.target));
      if (target?.isAlive) {
        getMeta(target).backdoorBonusTonight = true;
        res.logs.push(`Backdoor implant on ${target.id} (+1 consensus weight)`);
      }
    } else if (type === 'dns_spoof' && a.target) {
      if (isActorBlocked(a, frozenTargets, res)) continue;
      const target = playersById.get(resolveTarget(a.target));
      if (target?.isAlive) {
        getMeta(target).dnsVoteSpoofUntilDay = state.dayNumber + 1;
        const actor = playersById.get(a.actor);
        if (actor) getMeta(actor).scanMaskedUntilNight = state.nightNumber;
        res.logs.push(`DNS spoof on ${target.id} — random vote chaos next day`);
        res.privateResults.push({
          playerId: a.actor,
          payload: { type: 'dns_spoof', targetId: target.id },
        });
      }
    } else if (type === 'rigged_payload' && a.target) {
      if (isActorBlocked(a, frozenTargets, res)) continue;
      const target = playersById.get(resolveTarget(a.target));
      if (target?.isAlive) {
        getMeta(target).riggedPayloadUntilNight = state.nightNumber + 1;
        const actor = playersById.get(a.actor);
        if (actor) {
          const ameta = getMeta(actor);
          ameta.chaosShieldCharges = Math.min(
            CHAOS_DROPER_MAX_SHIELDS,
            (ameta.chaosShieldCharges ?? 0) + 1,
          );
        }
        res.logs.push(`Rigged payload on ${target.id} — ignores defenses next night`);
      }
    } else if (type === 'mirage_cloak') {
      if (isActorBlocked(a, frozenTargets, res)) continue;
      const actor = playersById.get(a.actor);
      if (actor?.isAlive) {
        getMeta(actor).scanMaskedUntilNight = state.nightNumber;
        res.logs.push(`Mirage cloak active on ${actor.id}`);
      }
    }
  }

  // ── Fase 1: Antivirus + respuesta a incidentes ──
  const antivirusResolved = new Set<string>();
  for (const a of actions) {
    const type = actionType(a);
    if (type === 'incident_clear' && a.target) {
      if (isActorBlocked(a, frozenTargets, res)) continue;
      const finalTarget = resolveTarget(a.target);
      const target = playersById.get(finalTarget);
      if (!target?.isAlive) continue;
      const tmeta = getMeta(target);
      const wasSilenced = (tmeta.silencedUntilDay ?? 0) >= state.dayNumber;
      const wasVoteBlocked = (tmeta.voteBlockedUntilDay ?? 0) >= state.dayNumber;
      tmeta.silencedUntilDay = 0;
      tmeta.voteBlockedUntilDay = 0;
      if (wasSilenced || wasVoteBlocked) {
        res.logs.push(`Incident response cleared restrictions on ${finalTarget}`);
        res.privateResults.push({
          playerId: a.actor,
          payload: { type: 'cured', targetId: finalTarget },
        });
      } else {
        res.logs.push(`Incident clear on ${finalTarget}: no active restrictions`);
      }
      continue;
    }

    if ((type !== 'protect' && type !== 'cure') || !a.target) continue;
    if (antivirusResolved.has(a.actor)) {
      res.logs.push(`EDR node ${a.actor}: extra ${type} ignored (single choice per night)`);
      continue;
    }
    if (isActorBlocked(a, frozenTargets, res)) continue;

    antivirusResolved.add(a.actor);
    const finalTarget = resolveTarget(a.target);

    if (type === 'protect') {
      const targetPlayer = playersById.get(finalTarget);
      if (targetPlayer && isRiggedPayload(targetPlayer, state.nightNumber)) {
        res.logs.push(`EDR protect on ${finalTarget} negated by rigged payload`);
        continue;
      }
      const stripped =
        targetPlayer && getMeta(targetPlayer).exploitStrippedUntilNight === state.nightNumber;
      if (stripped) {
        res.logs.push(`EDR protect on ${finalTarget} negated by exploit kit`);
      } else {
        protections.add(finalTarget);
        res.logs.push(`EDR protected ${finalTarget}`);
      }
      continue;
    }

    const target = playersById.get(finalTarget);
    if (!target?.isAlive) continue;

    if (isRiggedPayload(target, state.nightNumber)) {
      res.logs.push(`EDR cure on ${finalTarget} negated by rigged payload`);
      continue;
    }

    if (clearInfection(target)) {
      res.cures.push(finalTarget);
      res.logs.push(`EDR cured infection on ${finalTarget}`);
      res.privateResults.push({
        playerId: a.actor,
        payload: { type: 'cured', targetId: finalTarget },
      });
    } else {
      res.logs.push(`EDR cure on ${finalTarget}: no infection present`);
    }
  }

  // ── Fase 2: ataques — bombas lógicas, infecciones maduras, luego kills directos ──
  for (const p of state.players) {
    if (!p.isAlive) continue;
    const bombMeta = getMeta(p);
    if (!bombMeta.logicBombArmed) continue;
    bombMeta.logicBombArmed = false;
    const acted = actions.some(
      a =>
        a.actor === p.id &&
        !frozenTargets.has(a.actor) &&
        actionType(a) !== 'jam_hacker',
    );
    if (!acted) {
      res.logs.push(`Logic bomb on ${p.id} fizzled (no night action)`);
      continue;
    }
    const detonated = tryKill(p.id, state, res, 'logic bomb detonation', protections, {
      bypassProtection: true,
    });
    if (detonated) {
      processHoneypotDrag(p.id, state, res, protections);
      res.logs.push(`Logic bomb detonated on ${p.id} before action resolved`);
    }
  }

  processMatureInfections(state, res, protections);
  const hackerKillTarget = resolveHackerConsensus(actions, state, frozenTargets, playersById);
  if (hackerKillTarget) {
    const final = resolveTarget(hackerKillTarget);
    const targetPlayer = playersById.get(final);
    if (targetPlayer?.isAlive && isConsensusBlocked(targetPlayer, state.nightNumber)) {
      res.logs.push(`Hacker consensus kill on ${final} blocked by hardening patch`);
    } else {
      recordVisit('hacker_consensus', final, activityLabel('hacker_consensus'));
      const killed = tryKill(final, state, res, 'hacker consensus', protections);
      if (killed) {
        processHoneypotDrag(final, state, res, protections);
      }
      const ddosDegrade = actions.some(
        a =>
          actionType(a) === 'hacker_vote' &&
          a.target === hackerKillTarget &&
          playersById.get(a.actor)?.role === RoleName.DDOS &&
          !frozenTargets.has(a.actor),
      );
      if (ddosDegrade) {
        const target = playersById.get(final);
        if (target?.isAlive) {
          getMeta(target).silencedUntilDay = state.dayNumber + 1;
          if (!res.silenced.includes(final)) res.silenced.push(final);
          res.logs.push(`Traffic flood degraded ${final} until day ${state.dayNumber + 1}`);
        }
      }
    }
  }

  for (const a of actions) {
    const type = actionType(a);
    if (!a.target || isActorBlocked(a, frozenTargets, res)) continue;

    if (type === 'brute_force') {
      const final = resolveTarget(a.target);
      recordVisit(a.actor, final, activityLabel(type));
      const killed = tryKill(final, state, res, `brute force by ${a.actor}`, protections);
      if (killed) processHoneypotDrag(final, state, res, protections);
    } else if (type === 'pentester_kill') {
      const final = resolveTarget(a.target);
      const actor = playersById.get(a.actor);
      const target = playersById.get(final);
      recordVisit(a.actor, final, activityLabel(type));
      if (actor && target?.isAlive) {
        const sameTeam = target.team === actor.team && actor.team === Team.SYSTEM;
        const killed = tryKill(final, state, res, `pentester ${a.actor}`, protections);
        if (killed) {
          processHoneypotDrag(final, state, res, protections);
          if (sameTeam) {
            actor.isAlive = false;
            res.kills.push(a.actor);
            res.logs.push(`${a.actor} died during authorized penetration test`);
          }
        }
      }
    } else if (type === 'worm_infect' || type === 'worm_kill') {
      const final = resolveTarget(a.target);
      recordVisit(a.actor, final, activityLabel(type));
      const target = playersById.get(final);
      if (!target?.isAlive) continue;
      if (getMeta(target).wormBlockedUntilNight === state.nightNumber) {
        res.logs.push(`WAF blocked worm propagation to ${final}`);
        continue;
      }
      if (isInfected(target)) {
        res.logs.push(`${a.actor} tried to propagate malware to ${final}: already infected`);
        continue;
      }

      const infection = applyInfection(target, a.actor, 'worm', state.nightNumber);
      res.infections.push(final);
      res.logs.push(`${a.actor} propagated malware to ${final} (matures after night ${infection.maturesAfterNight})`);
      res.privateResults.push({
        playerId: a.actor,
        payload: {
          type: 'infected',
          targetId: final,
          infectionSource: 'worm',
          maturesAfterNight: infection.maturesAfterNight,
        },
      });
      res.privateResults.push({
        playerId: final,
        payload: {
          type: 'infection_warning',
          targetId: final,
          infectionSource: 'worm',
          maturesAfterNight: infection.maturesAfterNight,
        },
      });
    } else if (type === 'mine_crypto') {
      const final = resolveTarget(a.target);
      const actor = playersById.get(a.actor);
      if (actor?.isAlive) {
        const meta = getMeta(actor);
        if ((meta.shieldCharges ?? 0) < MINER_MAX_SHIELDS) {
          meta.shieldCharges = (meta.shieldCharges ?? 0) + 1;
          meta.lastMinedTarget = final;
          res.logs.push(`${a.actor} ran cryptojacking on ${final} (+1 shield → ${meta.shieldCharges}/${MINER_MAX_SHIELDS})`);
          res.privateResults.push({
            playerId: a.actor,
            payload: {
              type: 'miner_update',
              shieldCharges: meta.shieldCharges,
              minedTargetId: final,
            },
          });
        }
      }
    } else if (type === 'crypto_bribe') {
      const final = resolveTarget(a.target);
      recordVisit(a.actor, final, activityLabel(type));
      const actor = playersById.get(a.actor);
      const killed = tryKill(final, state, res, `covert strike by ${a.actor}`, protections);
      if (killed) processHoneypotDrag(final, state, res, protections);
      if (actor) {
        res.privateResults.push({
          playerId: a.actor,
          payload: {
            type: 'miner_update',
            shieldCharges: getMeta(actor).shieldCharges ?? 0,
            bribedTargetId: final,
            bribeKilled: killed,
          },
        });
      }
    } else if (type === 'ransomware') {
      const final = resolveTarget(a.target);
      recordVisit(a.actor, final, activityLabel(type));
      const target = playersById.get(final);
      if (target?.isAlive) {
        getMeta(target).silencedUntilDay = state.dayNumber + 1;
        res.silenced.push(final);
        res.logs.push(`${final} silenced until day ${state.dayNumber + 1}`);
      }
    } else if (type === 'ransom_note') {
      const final = resolveTarget(a.target);
      recordVisit(a.actor, final, activityLabel('ransomware'));
      const target = playersById.get(final);
      if (target?.isAlive) {
        getMeta(target).silencedUntilDay = state.dayNumber + 1;
        res.silenced.push(final);
        res.publicAnnouncements!.push(
          'Nota de rescate anónima: un nodo ha sido secuestrado operativamente hasta el amanecer.',
        );
        res.logs.push(`Ransom note on ${final} — silenced and public extortion posted`);
      }
    }
  }

  // ── Fase 3: investigaciones (resultados privados tras ataques) ──
  for (const a of actions) {
    const type = actionType(a);
    if (isActorBlocked(a, frozenTargets, res)) continue;

    if (type === 'intel_pulse') {
      const counts = countFactionAlive(state);
      res.privateResults.push({
        playerId: a.actor,
        payload: {
          type: 'intel_pulse',
          factionCounts: {
            system: counts.system,
            black_hat: counts.hackers,
            chaotic: counts.chaotics,
          },
        },
      });
      continue;
    }

    if (!a.target) continue;

    if (type === 'scan') {
      const finalTarget = resolveTarget(a.target);
      recordVisit(a.actor, finalTarget, activityLabel(type));
      const targetPlayer = playersById.get(finalTarget);
      let result = scanResult(targetPlayer, state.nightNumber);
      const minigame = a.meta?.minigameResult;
      if (minigame === 'failed' && result === 'malicious') {
        result = 'suspicious';
        res.logs.push(`SOC scan on ${finalTarget} degraded by failed skill check`);
      }
      res.privateResults.push({
        playerId: a.actor,
        payload: { type: 'scan', targetId: finalTarget, result },
      });
    } else if (type === 'team_probe') {
      const finalTarget = resolveTarget(a.target);
      recordVisit(a.actor, finalTarget, activityLabel(type));
      const targetPlayer = playersById.get(finalTarget);
      const probedTeam = targetPlayer?.team as Team | undefined;
      res.privateResults.push({
        playerId: a.actor,
        payload: { type: 'team_probe', targetId: finalTarget, probedTeam },
      });
    } else if (type === 'forensic_trace') {
      const finalTarget = resolveTarget(a.target);
      recordVisit(a.actor, finalTarget, activityLabel(type));
      const killedLastNight = state.lastNightKills
        .map(id => playersById.get(id))
        .filter((p): p is Player => !!p);
      const wasKilledLastNight = state.lastNightKills.includes(finalTarget);
      const teamTally = {
        system: killedLastNight.filter(p => p.team === Team.SYSTEM).length,
        black_hat: killedLastNight.filter(p => p.team === Team.BLACK_HAT).length,
        chaotic: killedLastNight.filter(p => p.team === Team.CHAOTIC).length,
      };
      res.privateResults.push({
        playerId: a.actor,
        payload: {
          type: 'forensic_trace',
          targetId: finalTarget,
          wasKilledLastNight,
          killTally: teamTally,
        },
      });
    } else if (type === 'data_leak') {
      const finalTarget = resolveTarget(a.target);
      const targetPlayer = playersById.get(finalTarget);
      const team = targetPlayer?.team as Team | undefined;
      if (team) {
        res.publicLeaks!.push({ team, nightNumber: state.nightNumber });
        res.logs.push(`Data leak queued for anonymous publication (team=${team})`);
      }
    } else if (type === 'threat_hunt') {
      const finalTarget = resolveTarget(a.target);
      recordVisit(a.actor, finalTarget, activityLabel(type));
      const targetPlayer = playersById.get(finalTarget);
      const scan = scanResult(targetPlayer, state.nightNumber);
      res.privateResults.push({
        playerId: a.actor,
        payload: { type: 'threat_hunt', targetId: finalTarget, threatDetected: isThreatScan(scan) },
      });
    } else if (type === 'ally_verify') {
      const finalTarget = resolveTarget(a.target);
      recordVisit(a.actor, finalTarget, activityLabel(type));
      const actor = playersById.get(a.actor);
      const targetPlayer = playersById.get(finalTarget);
      const isAlly = !!actor && !!targetPlayer && actor.team === targetPlayer.team;
      res.privateResults.push({
        playerId: a.actor,
        payload: {
          type: 'ally_verify',
          targetId: finalTarget,
          isAlly,
        },
      });
    } else if (type === 'lateral_probe') {
      const finalTarget = resolveTarget(a.target);
      recordVisit(a.actor, finalTarget, activityLabel(type));
      const targetPlayer = playersById.get(finalTarget);
      res.privateResults.push({
        playerId: a.actor,
        payload: {
          type: 'lateral_probe',
          targetId: finalTarget,
          isSystemMember: targetPlayer?.team === Team.SYSTEM,
        },
      });
    } else if (type === 'vote_trace') {
      const finalTarget = resolveTarget(a.target);
      recordVisit(a.actor, finalTarget, activityLabel(type));
      const traced = state.lastVoteByPlayer?.[finalTarget] ?? null;
      res.privateResults.push({
        playerId: a.actor,
        payload: { type: 'vote_trace', targetId: finalTarget, tracedVoteTargetId: traced },
      });
    } else if (type === 'vuln_scan') {
      const finalTarget = resolveTarget(a.target);
      recordVisit(a.actor, finalTarget, activityLabel(type));
      const targetPlayer = playersById.get(finalTarget);
      const compromised =
        !!targetPlayer &&
        (isInfected(targetPlayer) ||
          (getMeta(targetPlayer).silencedUntilDay ?? 0) >= state.dayNumber);
      res.privateResults.push({
        playerId: a.actor,
        payload: { type: 'vuln_scan', targetId: finalTarget, compromised },
      });
    } else if (type === 'cred_probe') {
      const finalTarget = resolveTarget(a.target);
      recordVisit(a.actor, finalTarget, activityLabel(type));
      const targetPlayer = playersById.get(finalTarget);
      const role = targetPlayer?.role as RoleName | undefined;
      const tier = role && CREDENTIAL_CRITICAL_ROLES.has(role) ? 'critical_defense' : 'standard';
      res.privateResults.push({
        playerId: a.actor,
        payload: { type: 'cred_probe', targetId: finalTarget, credentialTier: tier },
      });
    } else if (type === 'spy') {
      const finalTarget = resolveTarget(a.target);
      recordVisit(a.actor, finalTarget, activityLabel(type));
    } else if (type === 'zero_day_assume') {
      applyZeroDayAssume(state, a.actor, a.target);
      const assumedRole = playersById.get(a.actor)?.role as RoleName | undefined;
      if (assumedRole) {
        res.privateResults.push({
          playerId: a.actor,
          payload: buildRoleAssignedPayload(
            assumedRole,
            playersById.get(a.actor)?.team as Team,
          ),
        });
      }
    }
  }

  for (const a of actions) {
    if (actionType(a) !== 'ids_watch' || isActorBlocked(a, frozenTargets, res)) continue;
    const watchTarget = getMeta(playersById.get(a.actor)!).idsWatchTarget;
    if (!watchTarget) continue;
    const entries = visitLog.get(watchTarget) ?? [];
    const hostileCount = entries.filter(e => HOSTILE_ACTIVITIES.has(e.activity)).length;
    res.privateResults.push({
      playerId: a.actor,
      payload: {
        type: 'ids_alert',
        targetId: watchTarget,
        hostileVisitCount: hostileCount,
      },
    });
  }

  for (const [target, entries] of visitLog) {
    for (const a of actions) {
      if (actionType(a) !== 'spy' || !a.target) continue;
      if (resolveTarget(a.target) !== target) continue;

      const byPlayer = new Map<string, Set<string>>();
      for (const e of entries) {
        if (!byPlayer.has(e.playerId)) byPlayer.set(e.playerId, new Set());
        byPlayer.get(e.playerId)!.add(e.activity);
      }
      const visitorActivities = Array.from(byPlayer.entries()).map(([playerId, acts]) => ({
        playerId,
        activity: [...acts].join(', '),
      }));

      res.privateResults.push({
        playerId: a.actor,
        payload: {
          type: 'spy',
          targetId: target,
          visitors: visitorActivities.map(v => v.playerId),
          visitorActivities,
        },
      });
    }
  }

  for (const l of res.logs) state.log(l);
  state.clearActions();
  state.lastNightKills = [...res.kills];

  return res;
}

export default resolveNightActions;
