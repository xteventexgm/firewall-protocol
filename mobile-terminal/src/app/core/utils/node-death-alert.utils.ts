import { translateEliminationReason } from './game.utils';

export interface NodeDeathAlertData {
  headline: string;
  players: { name: string; role?: string }[];
  subtitle: string;
}

export function buildNodeDeathAlert(
  playersData: { name: string; role?: string }[],
  reason: string,
): NodeDeathAlertData | null {
  const players = playersData.filter(p => p.name && p.name.trim().length > 0);
  if (!players.length) return null;

  const headline =
    reason === 'vote'
      ? 'BANEO EJECUTADO'
      : reason === 'honeypot_drag'
        ? 'NODO ARRASTRADO'
        : 'NODO DESCONECTADO';

  const subtitle =
    reason === 'vote'
      ? 'Expulsado por votación diurna'
      : `Causa: ${translateEliminationReason(reason)}`;

  return { headline, players, subtitle };
}
