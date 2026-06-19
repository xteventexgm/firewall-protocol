import { PublicPlayer } from '../models/game-state.model';

export interface NodePosition {
  id: string;
  x: number;
  y: number;
  player: PublicPlayer;
  angle: number;
}

export function computeCircularLayout(
  players: PublicPlayer[],
  width: number,
  height: number,
  padding = 96,
): NodePosition[] {
  if (!players.length) return [];

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - padding;
  const step = (2 * Math.PI) / players.length;
  const startAngle = -Math.PI / 2;

  return players.map((player, index) => {
    const angle = startAngle + step * index;
    return {
      id: player.id,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      player,
      angle,
    };
  });
}

export function hubPoint(width: number, height: number): { x: number; y: number } {
  return { x: width / 2, y: height / 2 };
}

/** Punto en el borde del nodo hacia el hub (para líneas). */
export function edgePointToward(
  node: NodePosition,
  targetX: number,
  targetY: number,
  nodeRadius = 32,
): { x: number; y: number } {
  const dx = targetX - node.x;
  const dy = targetY - node.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: node.x + (dx / len) * nodeRadius,
    y: node.y + (dy / len) * nodeRadius,
  };
}
