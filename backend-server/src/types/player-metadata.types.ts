import { PlayerId } from './events.types';
import { RoleName } from './roles.types';

export interface PlayerMetadata {
  actedThisNight?: boolean;
  lastProtectedTarget?: PlayerId | null;
  pentesterUsesLeft?: number;
  shieldCharges?: number;
  ransomwareCooldown?: number;
  silencedUntilDay?: number;
  honeypotDragTarget?: PlayerId | null;
  phisherRedirects?: Record<PlayerId, PlayerId>;
  assumedFromPlayerId?: PlayerId | null;
  isWormImmune?: boolean;
}

export const ROLE_NIGHT_ACTIONS: Partial<Record<RoleName, string[]>> = {
  [RoleName.SOC_ANALYST]: ['scan'],
  [RoleName.ANTIVIRUS]: ['protect'],
  [RoleName.PENTESTER]: ['pentester_kill'],
  [RoleName.DEEP_FREEZE]: ['freeze'],
  [RoleName.BGP_ROUTER]: ['bgp_swap'],
  [RoleName.DDOS]: ['hacker_vote'],
  [RoleName.ROOTKIT]: ['hacker_vote'],
  [RoleName.RANSOMWARE]: ['ransomware'],
  [RoleName.SPYWARE]: ['spy'],
  [RoleName.PHISHER]: ['phisher_redirect'],
  [RoleName.WORM]: ['worm_kill'],
  [RoleName.ZERO_DAY]: ['zero_day_assume'],
  [RoleName.HONEYPOT]: ['honeypot_drag'],
};
