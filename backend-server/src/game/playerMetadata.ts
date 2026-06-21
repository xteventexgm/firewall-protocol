/**
 * Inicialización y helpers de metadata por jugador.
 *
 * `initRoleMetadata` se llama al repartir roles (`Room.startGame`).
 * Escalado por tamaño de mesa vía `balance.ts` (Pentester, Minero).
 */
import { RoleName } from '../types/roles.types';
import { Player } from '../models/PlayerProfile';
import { PlayerMetadata } from '../types/player-metadata.types';
import { minerShieldsForTable, pentesterUsesForTable } from './balance';

/** Crea metadata inicial según rol y número de jugadores al inicio de partida. */
export function initRoleMetadata(role: RoleName, playerCount = 15): PlayerMetadata {
  const base: PlayerMetadata = { actedThisNight: false };
  switch (role) {
    case RoleName.PENTESTER:
      return { ...base, pentesterUsesLeft: pentesterUsesForTable(playerCount) };
    case RoleName.CRYPTO_MINER:
      return { ...base, shieldCharges: minerShieldsForTable(playerCount) };
    case RoleName.RANSOMWARE:
      return { ...base, ransomwareCooldown: 0 };
    case RoleName.WORM:
      return { ...base, isWormImmune: true };
    case RoleName.HONEYPOT:
      return { ...base, honeypotDragTarget: null };
    case RoleName.ZERO_DAY:
      return { ...base, assumedFromPlayerId: null };
    case RoleName.SYSADMIN:
      return { ...base, emergencyPatchUsed: false, patchedVoterId: null };
    case RoleName.TROLL:
      return { ...base, trollProvokeUsedTonight: false };
    default:
      return base;
  }
}

/** Acceso tipado a metadata; crea objeto vacío si no existe. */
export function getMeta(player: Player): PlayerMetadata {
  if (!player.metadata) player.metadata = {};
  return player.metadata as PlayerMetadata;
}

/** Ransomware / DDoS silencian votación y acciones: activo si silencedUntilDay >= día actual. */
export function isSilenced(player: Player, currentDay: number): boolean {
  const meta = getMeta(player);
  return (meta.silencedUntilDay ?? 0) >= currentDay;
}

/** Al entrar en NOCHE: permite una nueva acción por jugador (`actedThisNight = false`). */
export function resetNightFlags(players: Player[]) {
  for (const p of players) {
    const meta = getMeta(p);
    meta.actedThisNight = false;
    meta.trollProvokeUsedTonight = false;
  }
}
