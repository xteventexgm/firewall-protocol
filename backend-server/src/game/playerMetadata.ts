import { RoleName } from '../types/roles.types';
import { Player } from '../models/PlayerProfile';
import { PlayerMetadata } from '../types/player-metadata.types';

export function initRoleMetadata(role: RoleName): PlayerMetadata {
  const base: PlayerMetadata = { actedThisNight: false };
  switch (role) {
    case RoleName.PENTESTER:
      return { ...base, pentesterUsesLeft: 2 };
    case RoleName.CRYPTO_MINER:
      return { ...base, shieldCharges: 3 };
    case RoleName.RANSOMWARE:
      return { ...base, ransomwareCooldown: 0 };
    case RoleName.WORM:
      return { ...base, isWormImmune: true };
    case RoleName.HONEYPOT:
      return { ...base, honeypotDragTarget: null };
    case RoleName.ZERO_DAY:
      return { ...base, assumedFromPlayerId: null };
    default:
      return base;
  }
}

export function getMeta(player: Player): PlayerMetadata {
  if (!player.metadata) player.metadata = {};
  return player.metadata as PlayerMetadata;
}

export function isSilenced(player: Player, currentDay: number): boolean {
  const meta = getMeta(player);
  return (meta.silencedUntilDay ?? 0) >= currentDay;
}

export function resetNightFlags(players: Player[]) {
  for (const p of players) {
    const meta = getMeta(p);
    meta.actedThisNight = false;
  }
}
