import { PlayerAction } from '../types/events.types';

function actionType(a: PlayerAction) {
  return (a.type || '').toLowerCase();
}

/** Mapa BGP swap target → swapWith (sin resolver cadena). */
export function buildSwapMapFromActions(actions: PlayerAction[]): Map<string, string> {
  const swapMap = new Map<string, string>();
  for (const a of actions) {
    if (actionType(a) === 'bgp_swap' && a.target && a.meta?.swapWith) {
      swapMap.set(a.target, a.meta.swapWith);
      swapMap.set(a.meta.swapWith, a.target);
    }
  }
  return swapMap;
}

export function resolveSwappedTarget(targetId: string, swapMap: Map<string, string>): string {
  let t = targetId;
  const visited = new Set<string>();
  while (swapMap.has(t) && !visited.has(t)) {
    visited.add(t);
    t = swapMap.get(t)!;
  }
  return t;
}

/**
 * Jugadores cuyas acciones nocturnas quedan anuladas por Deep Freeze.
 * Se calcula desde acciones `freeze` ya encoladas (respetando BGP swap).
 */
export function collectFrozenActors(
  actions: PlayerAction[],
  swapMap: Map<string, string> = buildSwapMapFromActions(actions),
): Set<string> {
  const frozen = new Set<string>();
  for (const a of actions) {
    if (actionType(a) === 'freeze' && a.target) {
      frozen.add(resolveSwappedTarget(a.target, swapMap));
    }
  }
  return frozen;
}

/**
 * Frozen set para validar un submit entrante (cola actual + freeze que se está enviando).
 */
export function frozenActorsForValidation(
  queuedActions: PlayerAction[],
  incoming?: PlayerAction,
): Set<string> {
  const all = incoming ? [...queuedActions, incoming] : queuedActions;
  return collectFrozenActors(all);
}
