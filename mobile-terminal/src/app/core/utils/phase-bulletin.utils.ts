import { GamePhase } from '../models/game-state.model';

const BULLETINS: Partial<Record<GamePhase, string>> = {
  REPARTO: 'Reparto de credenciales en curso — lee tu briefing de rol.',
  NOCHE: 'Modo sigilo: envía tu acción nocturna si tu rol tiene habilidad.',
  DIA: 'Auditoría diurna: debate, analiza el feed y prepara la votación.',
  VOTACION: 'Votación activa: elige a quién expulsar de la red.',
  VERIFICACION: 'Verificando integridad del sistema — espera al host.',
  FIN: 'Sesión terminada.',
};

export function phaseBulletin(phase: GamePhase | 'ELIMINATED'): string {
  if (phase === 'ELIMINATED') {
    return 'Tu nodo fue eliminado. Puedes seguir en el chat de espectadores.';
  }
  return BULLETINS[phase] ?? '';
}
