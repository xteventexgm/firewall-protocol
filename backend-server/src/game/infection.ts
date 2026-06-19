import { Player } from '../models/PlayerProfile';
import { PlayerInfection } from '../types/player-metadata.types';
import { getMeta } from './playerMetadata';

/** Noches tras infectar antes de que la infección pueda matar (2 = muere al resolver la segunda noche tras infectar). */
export const INFECTION_ROUNDS = 2;

export function getInfection(player: Player): PlayerInfection | null {
  const inf = getMeta(player).infection;
  return inf ?? null;
}

export function isInfected(player: Player): boolean {
  return getInfection(player) != null;
}

export function applyInfection(
  target: Player,
  sourcePlayerId: string,
  source: string,
  appliedOnNight: number,
): PlayerInfection {
  const infection: PlayerInfection = {
    sourcePlayerId,
    source,
    appliedOnNight,
    maturesAfterNight: appliedOnNight + INFECTION_ROUNDS,
  };
  getMeta(target).infection = infection;
  return infection;
}

export function clearInfection(player: Player): boolean {
  const meta = getMeta(player);
  if (!meta.infection) return false;
  delete meta.infection;
  return true;
}

/** Infección madura cuando la noche actual supera la noche en que se aplicó. */
export function isInfectionMature(infection: PlayerInfection, currentNight: number): boolean {
  return currentNight > infection.appliedOnNight;
}

export function infectionSourceLabel(infection: PlayerInfection): string {
  return infection.source || 'unknown';
}
