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

  if (payload.type === 'team_probe') {
    const target = resolvePlayerName(payload.targetId ?? '', players);
    const teamLabels: Record<string, string> = {
      system: 'System (Blue Team)',
      black_hat: 'Black Hat (Red Team)',
      chaotic: 'Caótico',
    };
    const team = payload.probedTeam ? teamLabels[payload.probedTeam] ?? payload.probedTeam : '?';
    return {
      nightNumber,
      status: 'resolved',
      headline: 'Sondeo de tráfico completado',
      details: [`Nodo: ${target}`, `Equipo detectado: ${team}`],
    };
  }

  if (payload.type === 'forensic_trace') {
    const target = resolvePlayerName(payload.targetId ?? '', players);
    const tally = payload.killTally;
    const details = [`Nodo consultado: ${target}`];
    if (tally) {
      details.push(
        `Bajas última noche — System: ${tally.system}, Black Hat: ${tally.black_hat}, Caótico: ${tally.chaotic}`,
      );
    }
    if (payload.wasKilledLastNight) {
      details.push('⚠ Este nodo estuvo entre las víctimas de la última noche.');
    } else {
      details.push('Este nodo no figuró entre las víctimas de la última noche.');
    }
    return { nightNumber, status: 'resolved', headline: 'Análisis forense', details };
  }

  if (payload.type === 'ids_alert') {
    const target = resolvePlayerName(payload.targetId ?? '', players);
    const count = payload.hostileVisitCount ?? 0;
    return {
      nightNumber,
      status: 'resolved',
      headline: count > 0 ? '⚠ Alerta IDS' : 'Vigilancia IDS — sin alertas',
      details: [
        `Nodo vigilado: ${target}`,
        count > 0
          ? `${count} visita(s) hostil(es) detectada(s) esta noche.`
          : 'Ninguna actividad hostil registrada sobre el nodo.',
      ],
    };
  }

  if (payload.type === 'threat_hunt') {
    const target = resolvePlayerName(payload.targetId ?? '', players);
    return {
      nightNumber,
      status: 'resolved',
      headline: 'Caza de amenazas completada',
      details: [
        `Nodo: ${target}`,
        payload.threatDetected ? 'Resultado: AMENAZA detectada' : 'Resultado: LIMPIO',
      ],
    };
  }

  if (payload.type === 'ally_verify') {
    const target = resolvePlayerName(payload.targetId ?? '', players);
    return {
      nightNumber,
      status: 'resolved',
      headline: 'Verificación de aliado',
      details: [
        `Nodo: ${target}`,
        payload.isAlly ? 'Pertenece a tu mismo bando.' : 'No es de tu bando.',
      ],
    };
  }

  if (payload.type === 'dns_spoof') {
    const target = resolvePlayerName(payload.targetId ?? '', players);
    return {
      nightNumber,
      status: 'resolved',
      headline: 'DNS envenenado',
      details: [
        `Nodo: ${target}`,
        'Su voto en la próxima votación se desviará al azar hacia otro nodo (distinto al que eligió).',
        'Apareces como SEGURO en escaneos SOC esta noche.',
      ],
    };
  }

  if (payload.type === 'lateral_probe') {
    const target = resolvePlayerName(payload.targetId ?? '', players);
    return {
      nightNumber,
      status: 'resolved',
      headline: 'Reconocimiento lateral',
      details: [
        `Nodo: ${target}`,
        payload.isSystemMember ? 'Pertenece al bando System.' : 'No es del bando System.',
      ],
    };
  }

  if (payload.type === 'vote_trace') {
    const target = resolvePlayerName(payload.targetId ?? '', players);
    const voted = payload.tracedVoteTargetId
      ? resolvePlayerName(payload.tracedVoteTargetId, players)
      : null;
    return {
      nightNumber,
      status: 'resolved',
      headline: 'Rastreo de voto',
      details: [
        `Nodo rastreado: ${target}`,
        voted ? `Votó a: ${voted}` : 'No votó o no hay registro de la última votación.',
      ],
    };
  }

  if (payload.type === 'vuln_scan') {
    const target = resolvePlayerName(payload.targetId ?? '', players);
    return {
      nightNumber,
      status: 'resolved',
      headline: 'Escaneo de vulnerabilidades',
      details: [
        `Nodo: ${target}`,
        payload.compromised ? 'Estado: COMPROMETIDO' : 'Estado: sin señales de compromiso',
      ],
    };
  }

  if (payload.type === 'cred_probe') {
    const target = resolvePlayerName(payload.targetId ?? '', players);
    const tier =
      payload.credentialTier === 'critical_defense' ? 'DEFENSA CRÍTICA' : 'PERFIL ESTÁNDAR';
    return {
      nightNumber,
      status: 'resolved',
      headline: 'Análisis de credenciales',
      details: [`Nodo: ${target}`, `Clasificación: ${tier}`],
    };
  }

  if (payload.type === 'intel_pulse' && payload.factionCounts) {
    const c = payload.factionCounts;
    return {
      nightNumber,
      status: 'resolved',
      headline: 'Pulso de inteligencia',
      details: [
        `System vivos: ${c.system}`,
        `Black Hat vivos: ${c.black_hat}`,
        `Caóticos vivos: ${c.chaotic}`,
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

  if (payload.type === 'miner_update') {
    const details: string[] = [];
    if (payload.minedTargetId) {
      const target = resolvePlayerName(payload.minedTargetId, players);
      details.push(`Minaste ${target} — +1 escudo.`);
      details.push(`Escudos actuales: ${payload.shieldCharges ?? '?'}/3`);
    }
    if (payload.bribedTargetId) {
      const target = resolvePlayerName(payload.bribedTargetId, players);
      details.push(`Soborno enviado contra ${target} (−1 escudo).`);
      details.push(
        payload.bribeKilled
          ? `✓ ${target} eliminado por soborno cripto.`
          : `El ataque contra ${target} fue bloqueado o falló.`,
      );
      details.push(`Escudos restantes: ${payload.shieldCharges ?? '?'}/3`);
    }
    return {
      nightNumber,
      status: 'resolved',
      headline: payload.minedTargetId ? 'Cryptojacking completado' : 'Soborno cripto resuelto',
      details,
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

    case 'chaos_route': {
      const routed = resolution.redirects?.some(
        (r) => r.actionId === 'chaos_route' && r.from === targetId && r.to === secondaryId,
      );
      if (routed && secondaryName) {
        details.push(`Desviaste ataques de ${targetName} hacia ${secondaryName}.`);
      } else {
        details.push(`Ruta caótica: ${targetName} → ${secondaryName ?? '?'}`);
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

    case 'brute_force':
      if (resolution.kills?.includes(targetId)) {
        details.push(`Fuerza bruta exitosa — ${targetName} eliminado.`);
        details.push('Has consumido tu único uso de esta habilidad.');
      } else {
        details.push(`Ataque de fuerza bruta contra ${targetName} bloqueado o falló.`);
      }
      break;

    case 'mine_crypto':
      details.push(`Minaste el procesamiento de ${targetName}.`);
      details.push('Ganaste +1 escudo (máx. 3 acumulables). La víctima no recibe aviso.');
      break;

    case 'crypto_bribe':
      if (resolution.kills?.includes(targetId)) {
        details.push(`Soborno exitoso — ${targetName} eliminado.`);
      } else {
        details.push(`Sobornaste al sistema contra ${targetName}, pero el nodo sobrevivió.`);
      }
      details.push('Consumiste 1 escudo de tu inventario.');
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

    case 'dns_spoof':
      details.push(`Envenenaste el resolver DNS de ${targetName}.`);
      details.push('Su voto en la próxima votación irá a otro nodo al azar (distinto al elegido).');
      break;

    case 'rigged_payload':
      details.push(`Carga manipulada sobre ${targetName}.`);
      details.push('La próxima noche ignorará protect, cure y respaldo.');
      details.push('+1 escudo caótico si tenías menos de 2.');
      break;

    case 'jam_hacker':
      details.push('Jam de señal activado sobre tu nodo.');
      details.push('Apareces SEGURO en escaneos SOC esta noche.');
      details.push('El consenso hacker no puede eliminarte esta noche.');
      details.push('Sobrevives un linchamiento al día siguiente.');
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
    chaos_route: 'Desvío caótico enviado',
    dns_spoof: 'Envenenamiento DNS enviado',
    rigged_payload: 'Carga manipulada enviada',
    jam_hacker: 'Jam de señal enviado',
    honeypot_drag: 'Trampa honeypot configurada',
    hacker_vote: 'Voto hacker registrado',
    ransomware: 'Secuestro enviado',
    phisher_redirect: 'Redirección de voto enviada',
    worm_infect: 'Infección enviada',
    worm_kill: 'Infección enviada',
    cure: 'Curación enviada',
    pentester_kill: 'Eliminación enviada',
    zero_day_assume: 'Asunción de identidad enviada',
    mine_crypto: 'Minado cripto enviado',
    crypto_bribe: 'Soborno cripto enviado',
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
    mine_crypto: 'Cryptojacking resuelto',
    crypto_bribe: 'Soborno cripto resuelto',
  };
  return map[actionType] ?? `Resultado nocturno — ${role}`;
}
