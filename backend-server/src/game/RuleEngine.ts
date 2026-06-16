import { NightActionBatch, PlayerAction } from '../types/events.types';
import { GameStateModel } from '../models/GameState';
import { ROLE_CATALOG } from '../types/roles.types';

type Resolution = {
  kills: string[]; // playerIds killed
  prevented: { actionId: string; reason: string }[];
  redirects: { actionId: string; from: string; to: string }[];
  logs: string[];
};

function actionPriority(a: PlayerAction) {
  if (a.priority !== undefined) return a.priority;
  if (a.role && ROLE_CATALOG[a.role]) return ROLE_CATALOG[a.role].priority || 0;
  return 0;
}

function isAttackType(type: string) {
  return ['attack', 'ddos', 'ransomware', 'ransom', 'infect', 'compromise'].includes(type.toLowerCase());
}

export function resolveNightActions(batch: NightActionBatch, state: GameStateModel): Resolution {
  const res: Resolution = { kills: [], prevented: [], redirects: [], logs: [] };

  const playersById = new Map(state.players.map(p => [p.id, p]));

  // Pre-flight: build protection, freeze, and redirect maps from actions of type protect/freeze/redirect/honeypot
  const protections = new Set<string>();
  const freezes = new Set<string>();
  const redirectMap = new Map<string, string>(); // originalTarget -> newTarget

  // sort actions by priority desc, timestamp asc
  const actions = batch.actions.slice().sort((a, b) => {
    const pa = actionPriority(a);
    const pb = actionPriority(b);
    if (pa !== pb) return pb - pa;
    return a.timestamp - b.timestamp;
  });

  // First pass: register non-attack modifiers with high-level effect
  for (const a of actions) {
    const type = (a.type || '').toLowerCase();
    if (type === 'protect' || type === 'antivirus' || type === 'heal') {
      if (a.target) protections.add(a.target);
      res.logs.push(`Protect action ${a.id} -> ${a.target}`);
    } else if (type === 'freeze' || type === 'deep_freeze') {
      if (a.target) freezes.add(a.target);
      res.logs.push(`Freeze action ${a.id} -> ${a.target}`);
    } else if (type === 'redirect' || type === 'honeypot' || type === 'bgp') {
      // redirect: meta.to indicates new target, or actor becomes the honeypot
      if (a.target) {
        const to = a.meta?.to || a.actor;
        redirectMap.set(a.target, to);
        res.logs.push(`Redirect action ${a.id} ${a.target} -> ${to}`);
      }
    }
  }

  // Second pass: resolve attack-like actions considering protections/freezes/redirects
  for (const a of actions) {
    const type = (a.type || '').toLowerCase();
    if (!a.target) continue;

    // Resolve redirect chain
    let finalTarget = a.target;
    const visited = new Set<string>();
    while (redirectMap.has(finalTarget) && !visited.has(finalTarget)) {
      visited.add(finalTarget);
      finalTarget = redirectMap.get(finalTarget)!;
      res.redirects.push({ actionId: a.id, from: a.target, to: finalTarget });
    }

    // If actor is frozen, their action may fail
    if (freezes.has(a.actor)) {
      res.prevented.push({ actionId: a.id, reason: 'actor_frozen' });
      res.logs.push(`Action ${a.id} prevented: actor ${a.actor} frozen`);
      continue;
    }

    if (isAttackType(type)) {
      // If final target protected, attack is prevented
      if (protections.has(finalTarget)) {
        res.prevented.push({ actionId: a.id, reason: 'protected' });
        res.logs.push(`Attack ${a.id} on ${finalTarget} prevented by protection`);
        continue;
      }
      // If final target frozen, treat as vulnerable or immune depending on rule: we'll assume frozen prevents actions on them but doesn't protect from kills
      // Execute the attack: mark target as killed
      const targetPlayer = playersById.get(finalTarget);
      if (targetPlayer && targetPlayer.isAlive) {
        targetPlayer.isAlive = false;
        res.kills.push(finalTarget);
        res.logs.push(`Attack ${a.id} succeeded: ${finalTarget} killed by ${a.actor}`);
      } else {
        res.logs.push(`Attack ${a.id} no-op: target ${finalTarget} missing or already dead`);
      }
    } else if (type === 'spy' || type === 'scan' || type === 'investigate') {
      // reveal some info (for now just log)
      res.logs.push(`Investigation ${a.id} by ${a.actor} targeted ${finalTarget}`);
    } else if (type === 'consume' || type === 'mine' || type === 'cryptomine') {
      // cause some resource-drain effect; represent as log for now
      res.logs.push(`Resource drain ${a.id} on ${finalTarget}`);
    } else {
      // Generic action
      res.logs.push(`Action ${a.id} type=${a.type} by ${a.actor} -> ${finalTarget}`);
    }
  }

  // Persist some resolution artifacts into state.logs
  for (const l of res.logs) state.log(l);

  // clear queued actions after resolution
  state.clearActions();

  return res;
}

export default resolveNightActions;
