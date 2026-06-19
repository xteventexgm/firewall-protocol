import { GamePhase, RoomPlayer } from '../models/game-state.model';

export type ViewerTeam = 'system' | 'black_hat' | 'chaotic' | string | undefined;

export interface PlayerNodeBadge {
  label: string;
  cssClass: string;
}

const FIN_TEAM_LABELS: Record<string, { label: string; cssClass: string }> = {
  system: { label: 'SISTEMA', cssClass: 'ally' },
  black_hat: { label: 'BLACK HAT', cssClass: 'hacker' },
  chaotic: { label: 'CAÓTICO', cssClass: 'chaotic' },
};

/**
 * Etiqueta de equipo en la topología según la perspectiva del jugador local.
 * - system: todos los demás aparecen como aliados (no se revelan hackers).
 * - black_hat: solo compañeros del payload hacker_team.
 * - chaotic: sin información de equipos ajenos ni propia en la lista.
 */
export function getPlayerNodeBadge(
  viewerTeam: ViewerTeam,
  player: RoomPlayer,
  myPlayerId: string,
  hackerMemberIds: string[],
  phase: GamePhase | 'ELIMINATED',
): PlayerNodeBadge | null {
  if (phase === 'LOBBY' || phase === 'REPARTO' || phase === 'ELIMINATED') {
    return null;
  }

  if (phase === 'FIN' && player.team) {
    return FIN_TEAM_LABELS[player.team] ?? null;
  }

  if (viewerTeam === 'chaotic') {
    return null;
  }

  if (viewerTeam === 'system') {
    if (player.id === myPlayerId) {
      return null;
    }
    return { label: 'ALIADO', cssClass: 'ally' };
  }

  if (viewerTeam === 'black_hat') {
    if (player.id === myPlayerId) {
      return null;
    }
    if (hackerMemberIds.includes(player.id)) {
      return { label: 'BLACK HAT', cssClass: 'hacker' };
    }
    return null;
  }

  return null;
}
