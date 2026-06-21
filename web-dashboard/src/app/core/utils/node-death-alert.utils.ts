import { translateEliminationReason } from './game.utils';

export interface NodeDeathAlertData {
  headline: string;
  playerNames: string[];
  subtitle: string;
}

export function buildNodeDeathAlert(
  playerNames: string[],
  reason: string,
): NodeDeathAlertData | null {
  const names = playerNames.map((n) => n.trim()).filter(Boolean);
  if (!names.length) return null;

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

  return { headline, playerNames: names, subtitle };
}
