import { NightActionBatch, NightResolution, PlayerAction, ScanResult } from '../types/events.types';
import { GameStateModel } from '../models/GameState';
import { Player } from '../models/PlayerProfile';
import { ROLE_CATALOG, RoleName, Team } from '../types/roles.types';
import { getMeta } from './playerMetadata';
import { applyZeroDayAssume } from './VictoryChecker';
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

  for (const a of actions) {
    if (actionType(a) !== 'hacker_vote' || !a.target) continue;
    if (!aliveHackers.has(a.actor)) continue;
    if (frozenActors.has(a.actor)) continue;
    const weight = playersById.get(a.actor)?.role === RoleName.DDOS ? 2 : 1;
    hackerVotes.set(a.target, (hackerVotes.get(a.target) || 0) + weight);
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

function scanResult(targetRole?: RoleName): ScanResult {
  if (!targetRole) return 'safe';
  if (targetRole === RoleName.ROOTKIT) return 'safe';
  const team = ROLE_CATALOG[targetRole].team;
  if (team === Team.SYSTEM) return 'safe';
  if (team === Team.CHAOTIC) return 'suspicious';
  return 'malicious';
}

const ACTIVITY_LABELS: Record<string, string> = {
  scan: 'correlación SOC',
  protect: 'protección EDR',
  cure: 'remediación',
  pentester_kill: 'exploit autorizado',
  worm_infect: 'propagación',
  worm_kill: 'propagación',
  ransomware: 'cifrado operativo',
  hacker_consensus: 'campaña coordinada',
  spy: 'interceptación',
  freeze: 'aislamiento',
  honeypot_drag: 'señuelo',
  phisher_redirect: 'engaño social',
  zero_day_assume: 'exploit 0-day',
};

function activityLabel(actionType: string): string {
  return ACTIVITY_LABELS[actionType] ?? 'actividad de red';
}

type KillOptions = {
  bypassProtection?: boolean;
  bypassMinerShield?: boolean;
};

function tryKill(
  targetId: string,
  state: GameStateModel,
  res: NightResolution,
  reason: string,
  protections: Set<string>,
  opts: KillOptions = {},
): boolean {
  if (!opts.bypassProtection && protections.has(targetId)) {
    res.logs.push(`Kill on ${targetId} prevented by Antivirus protection`);
    return false;
  }

  const target = state.getPlayer(targetId);
  if (!target?.isAlive) return false;

  const meta = getMeta(target);
  if (target.role === RoleName.WORM && meta.isWormImmune) {
    meta.isWormImmune = false;
    res.logs.push(`Kill on ${targetId} prevented: Gusano immune (first attack consumed)`);
    return false;
  }

  if (
    !opts.bypassMinerShield &&
    target.role === RoleName.CRYPTO_MINER &&
    (meta.shieldCharges ?? 0) > 0
  ) {
    meta.shieldCharges = (meta.shieldCharges ?? 0) - 1;
    res.logs.push(`Crypto Miner ${targetId} blocked direct attack (${meta.shieldCharges} shields left)`);
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
        infectionSource: infection.source,
        maturesAfterNight: currentNight,
        critical: true,
      },
    });

    if (tryKill(player.id, state, res, `infection from ${infectionSourceLabel(infection)}`, protections, {
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
  };

  const playersById = new Map(state.players.map(p => [p.id, p]));
  const protections = new Set<string>();
  const frozenTargets = new Set<string>();
  const swapMap = new Map<string, string>();
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
    }
  }

  for (const id of collectFrozenActors(actions, swapMap)) {
    frozenTargets.add(id);
    res.logs.push(`Deep Freeze on ${id} — night actions annulled`);
  }

  for (const a of actions) {
    const type = actionType(a);
    if (type === 'honeypot_drag' && a.target) {
      if (frozenTargets.has(a.actor)) continue;
      const actor = playersById.get(a.actor);
      if (actor) getMeta(actor).honeypotDragTarget = a.target;
    } else if (type === 'phisher_redirect' && a.target && a.meta?.redirectTo) {
      if (frozenTargets.has(a.actor)) continue;
      const actor = playersById.get(a.actor);
      if (actor) {
        const meta = getMeta(actor);
        if (!meta.phisherRedirects) meta.phisherRedirects = {};
        meta.phisherRedirects[a.target] = a.meta.redirectTo;
        res.logs.push(`Phisher redirect ${a.target} -> ${a.meta.redirectTo}`);
      }
    }
  }

  // ── Fase 1: Antivirus — una sola acción por jugador (protect O cure, no ambas) ──
  const antivirusResolved = new Set<string>();
  for (const a of actions) {
    const type = actionType(a);
    if ((type !== 'protect' && type !== 'cure') || !a.target) continue;
    if (antivirusResolved.has(a.actor)) {
      res.logs.push(`Antivirus ${a.actor}: extra ${type} ignored (single choice per night)`);
      continue;
    }
    if (isActorBlocked(a, frozenTargets, res)) continue;

    antivirusResolved.add(a.actor);
    const finalTarget = resolveTarget(a.target);

    if (type === 'protect') {
      protections.add(finalTarget);
      res.logs.push(`Antivirus protected ${finalTarget}`);
      continue;
    }

    const target = playersById.get(finalTarget);
    if (!target?.isAlive) continue;

    if (clearInfection(target)) {
      res.cures.push(finalTarget);
      res.logs.push(`Antivirus cured infection on ${finalTarget}`);
      res.privateResults.push({
        playerId: a.actor,
        payload: { type: 'cured', targetId: finalTarget },
      });
    } else {
      res.logs.push(`Antivirus cure on ${finalTarget}: no infection present`);
    }
  }

  // ── Fase 2: ataques — infecciones maduras, luego kills directos ──
  processMatureInfections(state, res, protections);
  const hackerKillTarget = resolveHackerConsensus(actions, state, frozenTargets, playersById);
  if (hackerKillTarget) {
    const final = resolveTarget(hackerKillTarget);
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
        res.logs.push(`DDoS degraded ${final} until day ${state.dayNumber + 1}`);
      }
    }
  }

  for (const a of actions) {
    const type = actionType(a);
    if (!a.target || isActorBlocked(a, frozenTargets, res)) continue;

    if (type === 'pentester_kill') {
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
            res.logs.push(`Pentester ${a.actor} died of guilt`);
          }
        }
      }
    } else if (type === 'worm_infect' || type === 'worm_kill') {
      const final = resolveTarget(a.target);
      recordVisit(a.actor, final, activityLabel(type));
      const target = playersById.get(final);
      if (!target?.isAlive) continue;
      if (isInfected(target)) {
        res.logs.push(`Worm ${a.actor} tried to infect ${final}: already infected`);
        continue;
      }

      const infection = applyInfection(target, a.actor, 'worm', state.nightNumber);
      res.infections.push(final);
      res.logs.push(`Worm ${a.actor} infected ${final} (matures after night ${infection.maturesAfterNight})`);
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
          infectionSource: 'worm',
          maturesAfterNight: infection.maturesAfterNight,
        },
      });
    } else if (type === 'ransomware') {
      const final = resolveTarget(a.target);
      recordVisit(a.actor, final, activityLabel(type));
      const target = playersById.get(final);
      if (target?.isAlive) {
        getMeta(target).silencedUntilDay = state.dayNumber + 1;
        res.silenced.push(final);
        res.logs.push(`Ransomware silenced ${final} until day ${state.dayNumber + 1}`);
      }
    }
  }

  // ── Fase 3: investigaciones (resultados privados tras ataques) ──
  for (const a of actions) {
    const type = actionType(a);
    if (!a.target || isActorBlocked(a, frozenTargets, res)) continue;

    if (type === 'scan') {
      const finalTarget = resolveTarget(a.target);
      recordVisit(a.actor, finalTarget, activityLabel(type));
      const targetPlayer = playersById.get(finalTarget);
      const result = scanResult(targetPlayer?.role as RoleName);
      res.privateResults.push({
        playerId: a.actor,
        payload: { type: 'scan', targetId: finalTarget, result },
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
