import { PublicNightResolution, PrivateResultPayload, RoomPlayer, ScanResult } from '../models/game-state.model';
import { infectionSourceLabel } from './game.utils';

export interface PendingNightAction {
  actionType: string;
  role: string;
  targetId: string;
  targetName: string;
  secondaryId?: string;
  secondaryName?: string;
  nightNumber: number;
}

export interface NightActionReport {
  nightNumber: number;
  status: 'pending' | 'resolved';
  headline: string;
  details: string[];
}

export function resolvePlayerName(id: string, players: RoomPlayer[]): string {
  return players.find((p) => p.id === id)?.name ?? id;
}

function scanResultLabel(result: ScanResult | undefined): string {
  if (result === 'malicious') return 'MALICIOSO';
  if (result === 'suspicious') return 'SOSPECHOSO';
  return 'SEGURO';
}

function scanResultDetail(result: ScanResult | undefined): string {
  if (result === 'malicious') return '⚠ Amenaza confirmada en este nodo.';
  if (result === 'suspicious') return '⚠ Comportamiento anómalo — rol caótico o actividad irregular.';
  return '✓ Sin amenazas detectadas en este nodo.';
}

export function buildPendingReport(action: PendingNightAction): NightActionReport {
  const lines: string[] = [`Objetivo: ${action.targetName}`];
  if (action.secondaryName) {
    lines.push(`Secundario: ${action.secondaryName}`);
  }
  lines.push('Esperando resolución de la noche...');

  return {
    nightNumber: action.nightNumber,
    status: 'pending',
    headline: pendingHeadline(action.role, action.actionType),
    details: lines,
  };
}

export function buildPrivateResultReport(
  payload: PrivateResultPayload,
  players: RoomPlayer[],
  nightNumber: number,
): NightActionReport | null {
  if (payload.type === 'scan') {
    const target = resolvePlayerName(payload.targetId ?? '', players);
    return {
      nightNumber,
      status: 'resolved',
      headline: 'Escaneo SOC completado',
      details: [
        `Nodo analizado: ${target}`,
        `Resultado: ${scanResultLabel(payload.result)}`,
        scanResultDetail(payload.result),
      ],
    };
  }

  if (payload.type === 'spy') {
    const target = resolvePlayerName(payload.targetId ?? '', players);
    const details: string[] = [`Nodo vigilado: ${target}`];
    if (payload.visitorActivities?.length) {
      for (const v of payload.visitorActivities) {
        const name = resolvePlayerName(v.playerId, players);
        details.push(`• ${name}: ${v.activity}`);
      }
    } else if (payload.visitors?.length) {
      const names = payload.visitors.map((id) => resolvePlayerName(id, players));
      details.push(`Visitantes: ${names.join(', ')}`);
    } else {
      details.push('Ningún visitante detectado esa noche.');
    }
    return { nightNumber, status: 'resolved', headline: 'Espionaje completado', details };
  }

  if (payload.type === 'role_assigned' && payload.role === 'Zero-Day') {
    return {
      nightNumber,
      status: 'resolved',
      headline: 'Identidad asumida',
      details: [
        `Nuevo rol: ${payload.displayName ?? payload.role}`,
        payload.description ?? 'Has tomado la identidad de un nodo caído.',
      ],
    };
  }

  if (payload.type === 'infected') {
    const target = resolvePlayerName(payload.targetId ?? '', players);
    return {
      nightNumber,
      status: 'resolved',
      headline: 'Infección propagada',
      details: [
        `Objetivo: ${target}`,
        `Fuente: ${infectionSourceLabel(payload.infectionSource)}`,
        payload.maturesAfterNight != null
          ? `Madurará tras resolver la noche N${payload.maturesAfterNight}.`
          : 'El objetivo caerá si un Antivirus no lo cura.',
      ],
    };
  }

  if (payload.type === 'infection_warning') {
    const source = infectionSourceLabel(payload.infectionSource);
    if (payload.critical) {
      return {
        nightNumber,
        status: 'resolved',
        headline: '☣ Infección CRÍTICA',
        details: [
          `Amenaza: ${source}`,
          'La infección madura esta noche — tu nodo caerá al amanecer si no te curaron.',
        ],
      };
    }
    return {
      nightNumber,
      status: 'resolved',
      headline: '☣ Has sido infectado',
      details: [
        `Fuente: ${source}`,
        payload.maturesAfterNight != null
          ? `Efecto mortal tras resolver la noche N${payload.maturesAfterNight} sin cura.`
          : 'Un Antivirus puede curarte antes de que madure.',
        'Recibirás otro aviso si la infección está a punto de matarte.',
      ],
    };
  }

  if (payload.type === 'cured') {
    const target = resolvePlayerName(payload.targetId ?? '', players);
    return {
      nightNumber,
      status: 'resolved',
      headline: 'Infección curada',
      details: [`Eliminaste la infección en ${target}.`],
    };
  }

  return null;
}

/** Resuelve acción nocturna usando solo PublicNightResolution (sin logs). */
export function buildResolvedReport(
  action: PendingNightAction,
  resolution: PublicNightResolution,
  myPlayerId: string,
  players: RoomPlayer[],
): NightActionReport {
  const { actionType, targetId, targetName, secondaryId, secondaryName, role, nightNumber } = action;
  const details: string[] = [];
  const headline = resolvedHeadline(role, actionType);

  switch (actionType) {
    case 'protect':
      if (!resolution.kills?.includes(targetId)) {
        details.push(`Protección activa sobre ${targetName}.`);
        details.push('Los ataques contra ese nodo fueron bloqueados o no ocurrieron.');
      } else {
        details.push(`Protegiste a ${targetName}, pero cayó esa noche.`);
      }
      break;

    case 'cure':
      if (resolution.cures?.includes(targetId)) {
        details.push(`Curaste la infección en ${targetName}.`);
      } else {
        details.push(`Intentaste curar a ${targetName}: no tenía infección activa.`);
      }
      break;

    case 'freeze':
      details.push(`Congelación aplicada a ${targetName}.`);
      details.push('Sus acciones nocturnas no surtieron efecto esa noche.');
      break;

    case 'bgp_swap': {
      const swapped = resolution.redirects?.some(
        (r) =>
          (r.from === targetId && r.to === secondaryId) ||
          (r.from === secondaryId && r.to === targetId),
      );
      if (swapped && secondaryName) {
        details.push(`Intercambiaste tráfico entre ${targetName} y ${secondaryName}.`);
      } else {
        details.push(`Intercambio configurado: ${targetName} ↔ ${secondaryName ?? '?'}`);
      }
      break;
    }

    case 'phisher_redirect':
      details.push(`Marcaste a ${targetName} para redirigir su voto diurno.`);
      if (secondaryName) {
        details.push(`Su voto en VOTACIÓN irá hacia ${secondaryName}.`);
      }
      break;

    case 'honeypot_drag': {
      details.push(`Trampa activa sobre ${targetName} si caes.`);
      const drag = resolution.honeypotDrags?.find((d) => d.honeypotId === myPlayerId);
      if (drag) {
        details.push(`⚠ Arrastraste a ${resolvePlayerName(drag.draggedId, players)} al caer.`);
      }
      break;
    }

    case 'ransomware':
      if (resolution.silenced?.includes(targetId)) {
        details.push(`Secuestraste a ${targetName} — silenciado hasta el próximo día.`);
      } else {
        details.push(`Intentaste secuestrar a ${targetName}.`);
      }
      break;

    case 'pentester_kill':
      if (resolution.kills?.includes(targetId)) {
        details.push(`Eliminaste a ${targetName}.`);
        if (resolution.kills.includes(myPlayerId)) {
          details.push('⚠ MATASTE A UN ALIADO — tu nodo también cayó.');
        }
      } else {
        details.push(`El ataque contra ${targetName} fue bloqueado o falló.`);
      }
      break;

    case 'worm_infect':
    case 'worm_kill':
      if (resolution.infections?.includes(targetId)) {
        details.push(`Infectaste a ${targetName}.`);
        details.push('Morirá al resolver la segunda noche sin cura de Antivirus.');
      } else {
        details.push(`No pudiste infectar a ${targetName} (ya infectado o bloqueado).`);
      }
      break;

    case 'hacker_vote':
      if (resolution.kills?.length) {
        const killedNames = resolution.kills.map((id) => resolvePlayerName(id, players));
        details.push(`Consenso hacker: ${killedNames.join(', ')} eliminado(s).`);
        if (resolution.kills.includes(targetId)) {
          details.push(`✓ Tu objetivo ${targetName} fue eliminado.`);
        } else {
          details.push(`Votaste a ${targetName}, pero el consenso fue otro.`);
        }
      } else {
        details.push(`Votaste eliminar a ${targetName}.`);
        details.push('No hubo consenso mayoritario entre hackers.');
      }
      break;

    default:
      details.push(`Acción registrada sobre ${targetName}.`);
  }

  if (resolution.kills?.includes(myPlayerId)) {
    details.push('⚠ Fuiste eliminado durante la noche.');
  }

  return { nightNumber, status: 'resolved', headline, details };
}

function pendingHeadline(role: string, actionType: string): string {
  const map: Record<string, string> = {
    scan: 'Escaneo en curso',
    spy: 'Espionaje en curso',
    protect: 'Protección enviada',
    freeze: 'Congelación enviada',
    bgp_swap: 'Intercambio BGP enviado',
    honeypot_drag: 'Trampa honeypot configurada',
    hacker_vote: 'Voto hacker registrado',
    ransomware: 'Secuestro enviado',
    phisher_redirect: 'Redirección de voto enviada',
    worm_infect: 'Infección enviada',
    worm_kill: 'Infección enviada',
    cure: 'Curación enviada',
    pentester_kill: 'Eliminación enviada',
    zero_day_assume: 'Asunción de identidad enviada',
  };
  return map[actionType] ?? `Comando nocturno — ${role}`;
}

function resolvedHeadline(role: string, actionType: string): string {
  const map: Record<string, string> = {
    scan: 'Escaneo SOC completado',
    spy: 'Espionaje completado',
    protect: 'Protección aplicada',
    freeze: 'Congelación aplicada',
    bgp_swap: 'Intercambio BGP resuelto',
    honeypot_drag: 'Honeypot — resultado',
    hacker_vote: 'Voto hacker resuelto',
    ransomware: 'Secuestro aplicado',
    phisher_redirect: 'Redirección de voto',
    worm_infect: 'Infección del Gusano',
    worm_kill: 'Infección del Gusano',
    cure: 'Curación aplicada',
    pentester_kill: 'Ataque del pentester',
    zero_day_assume: 'Identidad asumida',
  };
  return map[actionType] ?? `Resultado nocturno — ${role}`;
}
