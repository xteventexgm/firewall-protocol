import { PublicPlayer } from '../../core/models/game-state.model';

export interface NodePosition {
  id: string;
  x: number;
  y: number;
  player: PublicPlayer;
}

export function computeCircularLayout(
  players: PublicPlayer[],
  width: number,
  height: number,
  padding = 80,
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
    };
  });
}

export function getNodeCenter(positions: NodePosition[], id: string): { x: number; y: number } | null {
  const node = positions.find((p) => p.id === id);
  return node ? { x: node.x, y: node.y } : null;
}

export function countVotesPerTarget(votes: Record<string, string[]>, targetId: string): number {
  return (votes[targetId] ?? []).length;
}
