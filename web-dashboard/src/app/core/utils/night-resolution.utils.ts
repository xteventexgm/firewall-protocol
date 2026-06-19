import {
  NightResolution,
  PublicGameState,
  ScanResult,
} from '../models/game-state.model';
import { playerNameById } from './game.utils';

export interface NightResolutionSection {
  key: string;
  label: string;
  items: string[];
  tone: 'danger' | 'warn' | 'info' | 'success' | 'muted';
}

const SCAN_LABELS: Record<ScanResult, string> = {
  safe: 'Seguro',
  suspicious: 'Sospechoso',
  malicious: 'Malicioso',
};

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

  if (resolution.privateResults?.length) {
    const items = resolution.privateResults.map((pr) => {
      const player = name(pr.playerId);
      const payload = pr.payload;
      switch (payload.type) {
        case 'scan':
          return `${player}: escaneo → ${SCAN_LABELS[payload.result ?? 'safe']}`;
        case 'spy': {
          const acts = payload.visitorActivities?.length
            ? payload.visitorActivities
                .map((v) => `${name(v.playerId)} (${v.activity})`)
                .join(', ')
            : (payload.visitors ?? []).map(name).join(', ');
          return `${player}: espía → ${acts || 'sin visitantes'}`;
        }
        case 'hacker_team':
          return `${player}: equipo hacker (${(payload.members ?? []).map(name).join(', ')})`;
        case 'infected':
          return `${player}: infectado${payload.critical ? ' [CRÍTICO]' : ''}`;
        case 'cured':
          return `${player}: curado`;
        case 'infection_warning':
          return `${player}: alerta de infección`;
        case 'role_assigned':
          return `${player}: rol asignado — ${payload.displayName ?? payload.role ?? '?'}`;
        default:
          return `${player}: ${payload.type}`;
      }
    });
    sections.push({
      key: 'privateResults',
      label: 'Resultados privados (host)',
      items,
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
    !!resolution.redirects?.length ||
    !!resolution.privateResults?.length ||
    !!resolution.logs?.length
  );
}
