import {
  NightResolution,
  PublicGameState,
} from '../models/game-state.model';
import { playerNameById } from './game.utils';

export interface NightResolutionSection {
  key: string;
  label: string;
  items: string[];
  tone: 'danger' | 'warn' | 'info' | 'success' | 'muted';
}

export function buildNightResolutionSections(
  resolution: NightResolution,
  state: PublicGameState | null,
): NightResolutionSection[] {
  const name = (id: string) => playerNameById(state, id);
  const sections: NightResolutionSection[] = [];

  if (resolution.kills?.length) {
    sections.push({
      key: 'kills',
      label: 'Caídas nocturnas',
      items: resolution.kills.map((id) => name(id)),
      tone: 'danger',
    });
  }

  if (resolution.silenced?.length) {
    sections.push({
      key: 'silenced',
      label: 'Silenciados',
      items: resolution.silenced.map((id) => name(id)),
      tone: 'warn',
    });
  }

  if (resolution.infections?.length) {
    sections.push({
      key: 'infections',
      label: 'Infecciones',
      items: resolution.infections.map((id) => name(id)),
      tone: 'danger',
    });
  }

  if (resolution.cures?.length) {
    sections.push({
      key: 'cures',
      label: 'Curaciones',
      items: resolution.cures.map((id) => name(id)),
      tone: 'success',
    });
  }

  if (resolution.infectionKills?.length) {
    sections.push({
      key: 'infectionKills',
      label: 'Bajas por infección madura',
      items: resolution.infectionKills.map((id) => name(id)),
      tone: 'danger',
    });
  }

  if (resolution.honeypotDrags?.length) {
    sections.push({
      key: 'honeypotDrags',
      label: 'Arrastres honeypot',
      items: resolution.honeypotDrags.map(
        (d) => `${name(d.honeypotId)} → ${name(d.draggedId)}`,
      ),
      tone: 'warn',
    });
  }

  if (resolution.prevented?.length) {
    sections.push({
      key: 'prevented',
      label: 'Acciones bloqueadas',
      items: resolution.prevented.map((p) => p.reason),
      tone: 'muted',
    });
  }

  if (resolution.redirects?.length) {
    sections.push({
      key: 'redirects',
      label: 'Redirecciones',
      items: resolution.redirects.map(
        (r) => `${name(r.from)} → ${name(r.to)}`,
      ),
      tone: 'info',
    });
  }

  return sections;
}

export function hasNightResolutionContent(resolution: NightResolution): boolean {
  return (
    !!resolution.kills?.length ||
    !!resolution.silenced?.length ||
    !!resolution.infections?.length ||
    !!resolution.cures?.length ||
    !!resolution.infectionKills?.length ||
    !!resolution.honeypotDrags?.length ||
    !!resolution.prevented?.length ||
    !!resolution.redirects?.length
  );
}
