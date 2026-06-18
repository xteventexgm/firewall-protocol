import { NightResolution, RoomPlayer } from '../models/game-state.model';

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
  payload: any,
  players: RoomPlayer[],
  nightNumber: number,
): NightActionReport | null {
  if (payload.type === 'scan') {
    const target = resolvePlayerName(payload.targetId, players);
    const result = payload.result === 'malicious' ? 'MALICIOSO' : 'SEGURO';
    return {
      nightNumber,
      status: 'resolved',
      headline: 'Escaneo SOC completado',
      details: [
        `Nodo analizado: ${target}`,
        `Resultado: ${result}`,
        payload.result === 'malicious'
          ? '⚠ Tráfico sospechoso detectado en este nodo.'
          : '✓ Sin amenazas detectadas en este nodo.',
      ],
    };
  }

  if (payload.type === 'spy') {
    const target = resolvePlayerName(payload.targetId, players);
    const visitors: string[] = (payload.visitors ?? []).map((id: string) =>
      resolvePlayerName(id, players),
    );
    return {
      nightNumber,
      status: 'resolved',
      headline: 'Espionaje completado',
      details: [
        `Nodo vigilado: ${target}`,
        visitors.length
          ? `Visitantes detectados: ${visitors.join(', ')}`
          : 'Ningún visitante detectado esa noche.',
      ],
    };
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

  return null;
}

export function buildResolvedReport(
  action: PendingNightAction,
  resolution: NightResolution,
  logs: string[],
  myPlayerId: string,
  players: RoomPlayer[],
): NightActionReport {
  const { actionType, targetId, targetName, secondaryId, secondaryName, role, nightNumber } = action;
  const details: string[] = [];
  let headline = resolvedHeadline(role, actionType);

  switch (actionType) {
    case 'protect':
      if (logMatches(logs, `Antivirus protected ${targetId}`)) {
        details.push(`Protegiste a ${targetName} contra ataques nocturnos.`);
      } else {
        details.push(`Intentaste proteger a ${targetName}.`);
        details.push('La protección quedó registrada en el servidor.');
      }
      break;

    case 'freeze':
      if (logMatches(logs, `Deep Freeze on ${targetId}`)) {
        details.push(`Congelaste a ${targetName}.`);
        details.push('Sus acciones nocturnas no surtieron efecto.');
      } else {
        details.push(`Intentaste congelar a ${targetName}.`);
      }
      break;

    case 'bgp_swap':
      if (
        secondaryId &&
        (logMatches(logs, `BGP swap ${targetId} <-> ${secondaryId}`) ||
          logMatches(logs, `BGP swap ${secondaryId} <-> ${targetId}`))
      ) {
        details.push(`Intercambiaste tráfico entre ${targetName} y ${secondaryName}.`);
        details.push('Los ataques dirigidos a uno fueron redirigidos al otro.');
      } else {
        details.push(`Intercambio configurado: ${targetName} ↔ ${secondaryName ?? '?'}`);
      }
      break;

    case 'phisher_redirect':
      if (secondaryId && logMatches(logs, `Phisher redirect ${targetId} -> ${secondaryId}`)) {
        details.push(`Redirigiste las acciones de ${targetName} hacia ${secondaryName}.`);
      } else {
        details.push(`Redirección configurada: ${targetName} → ${secondaryName ?? '?'}`);
      }
      break;

    case 'honeypot_drag':
      details.push(`Marcaste a ${targetName} para arrastre si caes.`);
      {
        const drag = resolution.honeypotDrags?.find((d) => d.honeypotId === myPlayerId);
        if (drag) {
          const dragged = resolvePlayerName(drag.draggedId, players);
          details.push(`⚠ Arrastraste a ${dragged} al ser eliminado.`);
        } else {
          details.push('La trampa permanece activa si eres eliminado.');
        }
      }
      break;

    case 'ransomware':
      if (resolution.silenced?.includes(targetId)) {
        details.push(`Secuestraste a ${targetName}.`);
        details.push('Quedará silenciado y no podrá actuar ni votar hasta el próximo día.');
      } else {
        details.push(`Intentaste secuestrar a ${targetName}.`);
      }
      break;

    case 'pentester_kill': {
      const killed = resolution.kills?.includes(targetId);
      const guilt = logMatches(logs, `Pentester ${myPlayerId} died of guilt`);
      if (killed) {
        details.push(`Eliminaste a ${targetName}.`);
        if (guilt) details.push('⚠ MATASTE A UN ALIADO — tu nodo también cayó.');
      } else {
        const prevented = resolution.prevented?.find((p) => p.reason === 'actor_frozen');
        details.push(
          prevented
            ? `No pudiste actuar: fuiste congelado esa noche.`
            : `El ataque contra ${targetName} fue bloqueado o falló.`,
        );
      }
      break;
    }

    case 'worm_kill':
      if (resolution.kills?.includes(targetId)) {
        details.push(`Propagaste el ataque y eliminaste a ${targetName}.`);
      } else {
        details.push(`El ataque contra ${targetName} fue bloqueado o falló.`);
      }
      break;

    case 'hacker_vote':
      if (resolution.kills?.length) {
        const killedNames = resolution.kills.map((id) => resolvePlayerName(id, players));
        details.push(`El consenso hacker eliminó: ${killedNames.join(', ')}`);
        if (resolution.kills.includes(targetId)) {
          details.push(`✓ Tu objetivo ${targetName} fue eliminado.`);
        } else {
          details.push(`Tu voto fue hacia ${targetName}, pero el consenso fue otro.`);
        }
      } else {
        details.push(`Votaste eliminar a ${targetName}.`);
        details.push('No hubo consenso mayoritario entre hackers esa noche.');
      }
      break;

    default:
      details.push(`Acción ejecutada sobre ${targetName}.`);
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
    phisher_redirect: 'Redirección enviada',
    worm_kill: 'Ataque propagado',
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
    phisher_redirect: 'Redirección aplicada',
    worm_kill: 'Ataque del gusano',
    pentester_kill: 'Ataque del pentester',
    zero_day_assume: 'Identidad asumida',
  };
  return map[actionType] ?? `Resultado nocturno — ${role}`;
}

function logMatches(logs: string[], fragment: string): boolean {
  return logs.some((l) => l.includes(fragment));
}
