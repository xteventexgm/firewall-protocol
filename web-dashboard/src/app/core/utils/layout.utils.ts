import { PublicPlayer } from '../models/game-state.model';

export interface NodePosition {
  id: string;
  x: number;
  y: number;
  player: PublicPlayer;
  angle: number;
  tier: number;
}

/** Layout tipo red/araña: anillos concéntricos + hub central. Escala con muchos jugadores. */
export function computeSpiderLayout(
  players: PublicPlayer[],
  width: number,
  height: number,
  padding = 80,
): NodePosition[] {
  if (!players.length) return [];

  const cx = width / 2;
  const cy = height / 2;
  const count = players.length;
  const tierCount = count <= 6 ? 1 : count <= 11 ? 2 : count <= 16 ? 3 : 4;
  const perTier = Math.ceil(count / tierCount);
  const pad = count > 12 ? 56 : padding;
  const maxR = Math.min(width, height) / 2 - pad;

  return players.map((player, index) => {
    const tier = Math.floor(index / perTier);
    const indexInTier = index % perTier;
    const nodesInThisTier = Math.min(perTier, count - tier * perTier);
    const step = (2 * Math.PI) / nodesInThisTier;
    const angle = -Math.PI / 2 + step * indexInTier + tier * 0.18;
    const radiusFactor = tierCount === 1 ? 0.88 : 0.55 + (tier / Math.max(1, tierCount - 1)) * 0.38;
    const radius = maxR * radiusFactor;

    return {
      id: player.id,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      player,
      angle,
      tier,
    };
  });
}

/** @deprecated Usar computeSpiderLayout */
export function computeCircularLayout(
  players: PublicPlayer[],
  width: number,
  height: number,
  padding = 96,
): NodePosition[] {
  return computeSpiderLayout(players, width, height, padding);
}

export function hubPoint(width: number, height: number): { x: number; y: number } {
  return { x: width / 2, y: height / 2 };
}

export function edgePointToward(
  node: NodePosition,
  targetX: number,
  targetY: number,
  nodeRadius = 44,
): { x: number; y: number } {
  const dx = targetX - node.x;
  const dy = targetY - node.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: node.x + (dx / len) * nodeRadius,
    y: node.y + (dy / len) * nodeRadius,
  };
}
