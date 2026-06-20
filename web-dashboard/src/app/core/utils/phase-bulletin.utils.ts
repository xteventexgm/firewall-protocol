import { GamePhase } from '../models/game-state.model';

const BULLETINS: Partial<Record<GamePhase, string>> = {
  LOBBY: 'Sala en espera — los jugadores se conectan desde la Terminal Móvil.',
  REPARTO: 'Reparto automático de credenciales.',
  NOCHE: 'Modo sigilo — las acciones nocturnas se resuelven al amanecer.',
  DIA: 'Auditoría diurna — debate y análisis del feed SIEM.',
  VOTACION: 'Votación en curso — trazando conexiones de expulsión.',
  VERIFICACION: 'Comprobando condiciones de victoria.',
  FIN: 'Sesión terminada.',
};

export function phaseBulletin(phase: GamePhase): string {
  return BULLETINS[phase] ?? '';
}
