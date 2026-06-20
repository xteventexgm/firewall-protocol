/**
 * Genera entradas narrativas estilo SIEM para el feed público del dashboard.
 * No revela roles ni identidades exactas — solo eventos diegéticos.
 */
import { NightResolution } from '../types/events.types';
import { GameStateModel } from '../models/GameState';

export interface PublicLogEntry {
  id: string;
  timestamp: number;
  nightNumber?: number;
  dayNumber?: number;
  message: string;
  severity: 'info' | 'warn' | 'critical' | 'success';
}

let logCounter = 0;

function nextId(): string {
  logCounter += 1;
  return `plog_${Date.now()}_${logCounter}`;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} UTC`;
}

/** Entradas al iniciar partida. */
export function buildGameStartLogs(dayNumber: number): PublicLogEntry[] {
  const ts = Date.now();
  return [
    {
      id: nextId(),
      timestamp: ts,
      dayNumber,
      message: `${fmtTime(ts)} — FIREWALL PROTOCOL: sesión iniciada. Nodos en línea.`,
      severity: 'success',
    },
    {
      id: nextId(),
      timestamp: ts + 1,
      dayNumber,
      message: `${fmtTime(ts)} — Credenciales repartidas. Modo debate activo.`,
      severity: 'info',
    },
  ];
}

/** Convierte resolución nocturna en crónica pública. */
export function buildNightPublicLogs(
  state: GameStateModel,
  resolution: NightResolution,
): PublicLogEntry[] {
  const entries: PublicLogEntry[] = [];
  const ts = Date.now();
  const night = state.nightNumber;
  const t = fmtTime(ts);

  entries.push({
    id: nextId(),
    timestamp: ts,
    nightNumber: night,
    message: `${t} — Ciclo nocturno N${night} iniciado. Tráfico en modo sigilo.`,
    severity: 'info',
  });

  if (resolution.redirects.length) {
    entries.push({
      id: nextId(),
      timestamp: ts + 10,
      nightNumber: night,
      message: `${t} — Anomalía de enrutamiento BGP detectada. Destinos intercambiados.`,
      severity: 'warn',
    });
  }

  if (resolution.prevented.length) {
    entries.push({
      id: nextId(),
      timestamp: ts + 20,
      nightNumber: night,
      message: `${t} — EDR bloqueó ${resolution.prevented.length} intento(s) de eliminación.`,
      severity: 'success',
    });
  }

  if (resolution.silenced.length) {
    entries.push({
      id: nextId(),
      timestamp: ts + 30,
      nightNumber: night,
      message: `${t} — ${resolution.silenced.length} nodo(s) cifrados por ransomware operativo.`,
      severity: 'warn',
    });
  }

  if (resolution.infections.length) {
    entries.push({
      id: nextId(),
      timestamp: ts + 40,
      nightNumber: night,
      message: `${t} — Propagación de malware: ${resolution.infections.length} infección(es) activa(s).`,
      severity: 'critical',
    });
  }

  const cryptoMined = resolution.logs.some((l) => l.includes('mined'));
  if (cryptoMined) {
    entries.push({
      id: nextId(),
      timestamp: ts + 45,
      nightNumber: night,
      message: `${t} — Tráfico anómalo: patrones de cryptojacking en la red.`,
      severity: 'warn',
    });
  }

  const cryptoBribed = resolution.logs.some((l) => l.includes('crypto bribe'));
  if (cryptoBribed) {
    entries.push({
      id: nextId(),
      timestamp: ts + 48,
      nightNumber: night,
      message: `${t} — Alerta financiera: transacción no autorizada en capa de consenso.`,
      severity: 'critical',
    });
  }

  if (resolution.cures.length) {
    entries.push({
      id: nextId(),
      timestamp: ts + 50,
      nightNumber: night,
      message: `${t} — Antivirus remedia ${resolution.cures.length} infección(es).`,
      severity: 'success',
    });
  }

  if (resolution.honeypotDrags.length) {
    for (const drag of resolution.honeypotDrags) {
      entries.push({
        id: nextId(),
        timestamp: ts + 60,
        nightNumber: night,
        message: `${t} — TRAMPA HONEYPOT: arrastre en cadena detectado.`,
        severity: 'critical',
      });
    }
  }

  if (resolution.infectionKills.length) {
    entries.push({
      id: nextId(),
      timestamp: ts + 70,
      nightNumber: night,
      message: `${t} — Infección madura: ${resolution.infectionKills.length} nodo(s) caído(s).`,
      severity: 'critical',
    });
  }

  const directKills = resolution.kills.filter(
    (k) => !resolution.infectionKills.includes(k),
  );
  if (directKills.length) {
    entries.push({
      id: nextId(),
      timestamp: ts + 80,
      nightNumber: night,
      message: `${t} — ${directKills.length} nodo(s) offline tras incidente nocturno.`,
      severity: 'critical',
    });
  }

  if (
    !resolution.kills.length &&
    !resolution.infections.length &&
    !resolution.silenced.length
  ) {
    entries.push({
      id: nextId(),
      timestamp: ts + 90,
      nightNumber: night,
      message: `${t} — Noche sin bajas confirmadas. Sistema en alerta amarilla.`,
      severity: 'info',
    });
  }

  entries.push({
    id: nextId(),
    timestamp: ts + 100,
    nightNumber: night,
    message: `${fmtTime(ts + 100)} — Amanecer D${state.dayNumber + 1}. Restaurando visibilidad.`,
    severity: 'info',
  });

  return entries;
}

/** Log de votación diurna. */
export function buildVoteLog(
  eliminatedId: string | null,
  voteCount: number,
  dayNumber: number,
): PublicLogEntry {
  const ts = Date.now();
  if (eliminatedId) {
    return {
      id: nextId(),
      timestamp: ts,
      dayNumber,
      message: `${fmtTime(ts)} — Votación D${dayNumber}: nodo expulsado (${voteCount} votos).`,
      severity: 'critical',
    };
  }
  return {
    id: nextId(),
    timestamp: ts,
    dayNumber,
    message: `${fmtTime(ts)} — Votación D${dayNumber}: sin consenso. Ciclo nocturno reanudado.`,
    severity: 'warn',
  };
}

/** Mensaje anónimo del Troll (provoke). */
export function buildTrollProvokeLog(message: string, nightNumber: number): PublicLogEntry {
  const ts = Date.now();
  return {
    id: nextId(),
    timestamp: ts,
    nightNumber,
    message: `${fmtTime(ts)} — [ANÓNIMO] ${message}`,
    severity: 'warn',
  };
}

/** Log de fin de partida. */
export function buildGameOverLog(winnerLabel: string): PublicLogEntry {
  const ts = Date.now();
  return {
    id: nextId(),
    timestamp: ts,
    message: `${fmtTime(ts)} — SESIÓN TERMINADA: ${winnerLabel}`,
    severity: 'success',
  };
}
