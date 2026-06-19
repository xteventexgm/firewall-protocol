/**
 * Metadata por jugador y mapa acción-nocturna ↔ rol.
 *
 * `PlayerMetadata` se guarda en `player.metadata` (JSON persistido).
 * `ROLE_NIGHT_ACTIONS` define qué `type` acepta ActionValidator por rol.
 */
import { PlayerId } from './events.types';
import { RoleName } from './roles.types';

/** Estado de infección (Gusano u otra fuente) sobre un nodo. */
export interface PlayerInfection {
  sourcePlayerId: PlayerId;
  /** Origen de la infección: worm, etc. */
  source: string;
  appliedOnNight: number;
  maturesAfterNight: number;
}

/**
 * Flags runtime por jugador. Inicializados en `initRoleMetadata` (`playerMetadata.ts`).
 * Algunos campos se ocultan a otros clientes vía `GameStateModel.sanitizeMetadata`.
 */
export interface PlayerMetadata {
  actedThisNight?: boolean;
  lastProtectedTarget?: PlayerId | null;
  lastCuredTarget?: PlayerId | null;
  pentesterUsesLeft?: number;
  shieldCharges?: number;
  ransomwareCooldown?: number;
  silencedUntilDay?: number;
  honeypotDragTarget?: PlayerId | null;
  phisherRedirects?: Record<PlayerId, PlayerId>;
  assumedFromPlayerId?: PlayerId | null;
  isWormImmune?: boolean;
  infection?: PlayerInfection;
}

/** Tipos de acción nocturna permitidos por rol (validados en ActionValidator). */
export const ROLE_NIGHT_ACTIONS: Partial<Record<RoleName, string[]>> = {
  [RoleName.SOC_ANALYST]: ['scan'],
  [RoleName.ANTIVIRUS]: ['protect', 'cure'],
  [RoleName.PENTESTER]: ['pentester_kill'],
  [RoleName.DEEP_FREEZE]: ['freeze'],
  [RoleName.BGP_ROUTER]: ['bgp_swap'],
  [RoleName.DDOS]: ['hacker_vote'],
  [RoleName.ROOTKIT]: ['hacker_vote'],
  [RoleName.RANSOMWARE]: ['ransomware'],
  [RoleName.SPYWARE]: ['spy'],
  [RoleName.PHISHER]: ['phisher_redirect'],
  [RoleName.WORM]: ['worm_infect', 'worm_kill'],
  [RoleName.ZERO_DAY]: ['zero_day_assume'],
  [RoleName.HONEYPOT]: ['honeypot_drag'],
};
