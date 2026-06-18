import { NightActionBatch, PlayerAction, PrivateResultPayload, ScanResult } from '../types/events.types';
import { GameStateModel } from '../models/GameState';
import { ROLE_CATALOG, RoleName, Team } from '../types/roles.types';
import { getMeta } from './playerMetadata';
import { applyZeroDayAssume } from './VictoryChecker';

export type NightResolution = {
  kills: string[];
  prevented: { actionId: string; reason: string }[];
  redirects: { actionId: string; from: string; to: string }[];
  logs: string[];
  privateResults: { playerId: string; payload: PrivateResultPayload }[];
  silenced: string[];
  honeypotDrags: { honeypotId: string; draggedId: string }[];
};

function actionPriority(a: PlayerAction) {
  if (a.priority !== undefined) return a.priority;
  if (a.role && ROLE_CATALOG[a.role]) return ROLE_CATALOG[a.role].priority || 0;
  return 0;
}

function resolveHackerConsensus(
  actions: PlayerAction[],
  state: GameStateModel,
): string | null {
  const hackerVotes = new Map<string, number>();
  const aliveHackers = new Set(
    state.players.filter(p => p.isAlive && p.team === Team.BLACK_HAT).map(p => p.id),
  );

  for (const a of actions) {
    if ((a.type || '').toLowerCase() !== 'hacker_vote' || !a.target) continue;
    if (!aliveHackers.has(a.actor)) continue;
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
    res.logs.push(`Kill on ${targetId} prevented by protection`);
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

export function resolveNightActions(batch: NightActionBatch, state: GameStateModel): NightResolution {
  const res: NightResolution = {
    kills: [],
    prevented: [],
    redirects: [],
    logs: [],
    privateResults: [],
    silenced: [],
    honeypotDrags: [],
  };

  const playersById = new Map(state.players.map(p => [p.id, p]));
  const protections = new Set<string>();
  const frozenTargets = new Set<string>();
  const swapMap = new Map<string, string>();
  const visitLog = new Map<string, string[]>();
  const wormImmune = new Set(
    state.players.filter(p => p.isAlive && p.role === RoleName.WORM).map(p => p.id),
  );

  const actions = batch.actions.slice().sort((a, b) => {
    const pa = actionPriority(a);
    const pb = actionPriority(b);
    if (pa !== pb) return pb - pa;
    return a.timestamp - b.timestamp;
  });

  for (const a of actions) {
    const type = (a.type || '').toLowerCase();
    if (type === 'protect' && a.target) {
      protections.add(a.target);
      res.logs.push(`Antivirus protected ${a.target}`);
    } else if (type === 'freeze' && a.target) {
      frozenTargets.add(a.target);
      res.logs.push(`Deep Freeze on ${a.target}`);
    } else if (type === 'bgp_swap' && a.target && a.meta?.swapWith) {
      swapMap.set(a.target, a.meta.swapWith);
      swapMap.set(a.meta.swapWith, a.target);
      res.logs.push(`BGP swap ${a.target} <-> ${a.meta.swapWith}`);
    } else if (type === 'honeypot_drag' && a.target) {
      const actor = playersById.get(a.actor);
      if (actor) getMeta(actor).honeypotDragTarget = a.target;
    } else if (type === 'phisher_redirect' && a.target && a.meta?.redirectTo) {
      const actor = playersById.get(a.actor);
      if (actor) {
        const meta = getMeta(actor);
        if (!meta.phisherRedirects) meta.phisherRedirects = {};
        meta.phisherRedirects[a.target] = a.meta.redirectTo;
        res.logs.push(`Phisher redirect ${a.target} -> ${a.meta.redirectTo}`);
      }
    }
  }

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

  for (const a of actions) {
    const type = (a.type || '').toLowerCase();
    if (!a.target && type !== 'hacker_vote') continue;
    if (frozenTargets.has(a.actor)) {
      res.prevented.push({ actionId: a.id, reason: 'actor_frozen' });
      continue;
    }

    if (type === 'scan' && a.target) {
      const finalTarget = resolveTarget(a.target);
      const targetPlayer = playersById.get(finalTarget);
      const result = scanResult(targetPlayer?.role as RoleName);
      res.privateResults.push({
        playerId: a.actor,
        payload: { type: 'scan', targetId: finalTarget, result },
      });
      recordVisit(a.actor, finalTarget);
    } else if (type === 'spy' && a.target) {
      const finalTarget = resolveTarget(a.target);
      recordVisit(a.actor, finalTarget);
    } else if (type === 'ransomware' && a.target) {
      const finalTarget = resolveTarget(a.target);
      const target = playersById.get(finalTarget);
      if (target?.isAlive) {
        getMeta(target).silencedUntilDay = state.dayNumber + 1;
        res.silenced.push(finalTarget);
        res.logs.push(`Ransomware silenced ${finalTarget} until day ${state.dayNumber + 1}`);
      }
      recordVisit(a.actor, finalTarget);
    } else if (type === 'zero_day_assume' && a.target) {
      applyZeroDayAssume(state, a.actor, a.target);
      res.privateResults.push({
        playerId: a.actor,
        payload: {
          type: 'role_assigned',
          role: playersById.get(a.actor)?.role,
          team: playersById.get(a.actor)?.team as Team,
        },
      });
    }
  }

  for (const [target, visitors] of visitLog) {
    for (const a of actions) {
      if ((a.type || '').toLowerCase() === 'spy' && a.target && resolveTarget(a.target) === target) {
        res.privateResults.push({
          playerId: a.actor,
          payload: { type: 'spy', targetId: target, visitors: [...new Set(visitors)] },
        });
      }
    }
  }

  const hackerKillTarget = resolveHackerConsensus(actions, state);
  if (hackerKillTarget) {
    const final = resolveTarget(hackerKillTarget);
    tryKill(final, state, res, 'hacker consensus', protections, wormImmune);
    if (res.kills.includes(final)) processHoneypotDrag(final, state, res, protections, wormImmune);
  }

  for (const a of actions) {
    const type = (a.type || '').toLowerCase();
    if (frozenTargets.has(a.actor)) continue;

    if (type === 'pentester_kill' && a.target) {
      const final = resolveTarget(a.target);
      const actor = playersById.get(a.actor);
      const target = playersById.get(final);
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
    } else if (type === 'worm_kill' && a.target) {
      const final = resolveTarget(a.target);
      if (tryKill(final, state, res, `worm ${a.actor}`, protections, wormImmune)) {
        processHoneypotDrag(final, state, res, protections, wormImmune);
      }
    }
  }

  for (const l of res.logs) state.log(l);
  state.clearActions();
  state.lastNightKills = [...res.kills];

  return res;
}

export default resolveNightActions;
