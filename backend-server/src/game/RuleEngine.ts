import { NightActionBatch, PlayerAction, PrivateResultPayload, ScanResult } from '../types/events.types';
import { GameStateModel } from '../models/GameState';
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

export type NightResolution = {
  kills: string[];
  prevented: { actionId: string; reason: string }[];
  redirects: { actionId: string; from: string; to: string }[];
  logs: string[];
  privateResults: { playerId: string; payload: PrivateResultPayload }[];
  silenced: string[];
  honeypotDrags: { honeypotId: string; draggedId: string }[];
  infections: string[];
  cures: string[];
  infectionKills: string[];
};

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
): string | null {
  const hackerVotes = new Map<string, number>();
  const aliveHackers = new Set(
    state.players.filter(p => p.isAlive && p.team === Team.BLACK_HAT).map(p => p.id),
  );

  for (const a of actions) {
    if (actionType(a) !== 'hacker_vote' || !a.target) continue;
    if (!aliveHackers.has(a.actor)) continue;
    if (frozenActors.has(a.actor)) continue;
    hackerVotes.set(a.target, (hackerVotes.get(a.target) || 0) + 1);
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
  return team === Team.SYSTEM ? 'safe' : 'malicious';
}

function tryKill(
  targetId: string,
  state: GameStateModel,
  res: NightResolution,
  reason: string,
  protections: Set<string>,
  wormImmune: Set<string>,
): boolean {
  if (protections.has(targetId)) {
    res.logs.push(`Kill on ${targetId} prevented by Antivirus protection`);
    return false;
  }
  if (wormImmune.has(targetId)) {
    res.logs.push(`Kill on ${targetId} prevented: Gusano immune`);
    return false;
  }

  const target = state.getPlayer(targetId);
  if (!target?.isAlive) return false;

  const meta = getMeta(target);
  if (target.role === RoleName.CRYPTO_MINER && (meta.shieldCharges ?? 0) > 0) {
    meta.shieldCharges = (meta.shieldCharges ?? 0) - 1;
    res.logs.push(`Crypto Miner ${targetId} blocked attack (${meta.shieldCharges} shields left)`);
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
  wormImmune: Set<string>,
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

    if (tryKill(player.id, state, res, `infection from ${infectionSourceLabel(infection)}`, protections, wormImmune)) {
      res.infectionKills.push(player.id);
      clearInfection(player);
      processHoneypotDrag(player.id, state, res, protections, wormImmune);
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
  wormImmune: Set<string>,
) {
  const dead = state.getPlayer(deadId);
  if (dead?.role !== RoleName.HONEYPOT) return;
  const dragTarget = getMeta(dead).honeypotDragTarget;
  if (!dragTarget) return;
  if (tryKill(dragTarget, state, res, `honeypot drag from ${deadId}`, protections, wormImmune)) {
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
  const visitLog = new Map<string, string[]>();
  const wormImmune = new Set(
    state.players.filter(p => p.isAlive && p.role === RoleName.WORM).map(p => p.id),
  );

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

  const recordVisit = (visitor: string, target: string) => {
    const list = visitLog.get(target) || [];
    list.push(visitor);
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
  processMatureInfections(state, res, protections, wormImmune);
  const hackerKillTarget = resolveHackerConsensus(actions, state, frozenTargets);
  if (hackerKillTarget) {
    const final = resolveTarget(hackerKillTarget);
    recordVisit('hacker_consensus', final);
    if (tryKill(final, state, res, 'hacker consensus', protections, wormImmune)) {
      processHoneypotDrag(final, state, res, protections, wormImmune);
    }
  }

  for (const a of actions) {
    const type = actionType(a);
    if (!a.target || isActorBlocked(a, frozenTargets, res)) continue;

    if (type === 'pentester_kill') {
      const final = resolveTarget(a.target);
      const actor = playersById.get(a.actor);
      const target = playersById.get(final);
      recordVisit(a.actor, final);
      if (actor && target?.isAlive) {
        const sameTeam = target.team === actor.team && actor.team === Team.SYSTEM;
        const killed = tryKill(final, state, res, `pentester ${a.actor}`, protections, wormImmune);
        if (killed) {
          processHoneypotDrag(final, state, res, protections, wormImmune);
          if (sameTeam) {
            actor.isAlive = false;
            res.kills.push(a.actor);
            res.logs.push(`Pentester ${a.actor} died of guilt`);
          }
        }
      }
    } else if (type === 'worm_infect' || type === 'worm_kill') {
      const final = resolveTarget(a.target);
      recordVisit(a.actor, final);
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
      recordVisit(a.actor, final);
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
      recordVisit(a.actor, finalTarget);
      const targetPlayer = playersById.get(finalTarget);
      const result = scanResult(targetPlayer?.role as RoleName);
      res.privateResults.push({
        playerId: a.actor,
        payload: { type: 'scan', targetId: finalTarget, result },
      });
    } else if (type === 'spy') {
      const finalTarget = resolveTarget(a.target);
      recordVisit(a.actor, finalTarget);
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

  for (const [target, visitors] of visitLog) {
    for (const a of actions) {
      if (actionType(a) !== 'spy' || !a.target) continue;
      if (resolveTarget(a.target) !== target) continue;
      res.privateResults.push({
        playerId: a.actor,
        payload: { type: 'spy', targetId: target, visitors: [...new Set(visitors)] },
      });
    }
  }

  for (const l of res.logs) state.log(l);
  state.clearActions();
  state.lastNightKills = [...res.kills];

  return res;
}

export default resolveNightActions;
