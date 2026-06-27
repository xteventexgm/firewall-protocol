import { SessionThreatBrief } from '../models/game-state.model';

export interface ThreatBriefingView {
  code: string;
  title: string;
  lead: string;
  footer: string;
  accent: 'system' | 'black_hat' | 'chaotic';
  stats: Array<{ label: string; value: string }>;
}

export function buildThreatBriefingView(
  team: 'system' | 'black_hat' | 'chaotic' | string,
  brief: SessionThreatBrief,
): ThreatBriefingView {
  const hackers = brief.hackerCount;
  const intruders = brief.intruderCount;
  const threats = hackers + intruders;

  if (team === 'black_hat') {
    return {
      accent: 'black_hat',
      code: 'CANAL ENCRIPTADO — BLACK HAT',
      title: 'ACCESO A LA RED EXITOSO',
      lead:
        `Infiltración completada. Operan <strong>${hackers}</strong> ` +
        `${hackers === 1 ? 'agente hostil' : 'agentes hostiles'} en la red sin levantar alerta crítica. ` +
        'El equipo defensor aún no ha correlacionado las anomalías.',
      footer: 'Mantened silencio operativo. Coordinad acciones nocturnas con vuestro equipo.',
      stats: [
        { label: 'Nodos en línea', value: String(brief.nodeCount) },
        { label: 'Agentes Black Hat', value: String(hackers) },
        { label: 'Defensores estimados', value: String(brief.systemCount) },
      ],
    };
  }

  if (team === 'chaotic') {
    return {
      accent: 'chaotic',
      code: 'SEÑAL DESCONOCIDA — ORIGEN NO ATRIBUIDO',
      title: 'VECTOR CAÓTICO ACTIVO',
      lead:
        `Tu nodo quedó registrado como intruso independiente. Hay <strong>${intruders}</strong> ` +
        `${intruders === 1 ? 'vector caótico' : 'vectores caóticos'} sin alianza fija en la red. ` +
        'Nadie controla tu movimiento: sobrevive, provoca caos y evita quedar expuesto.',
      footer: 'No confíes en las alianzas visibles. Tu victoria es solitaria o por caos controlado.',
      stats: [
        { label: 'Nodos en línea', value: String(brief.nodeCount) },
        { label: 'Vectores caóticos', value: String(intruders) },
        { label: 'Amenazas totales', value: String(threats) },
      ],
    };
  }

  return {
    accent: 'system',
    code: 'ALERTA SIEM — ANOMALÍAS EN LA RED',
    title: 'SE ENCONTRARON ANOMALÍAS EN LA RED',
    lead:
      `Se detectaron anomalías en la red: ${hackers} ` +
      `${hackers === 1 ? 'agente hostil' : 'agentes hostiles'} (Black Hat) y ${intruders} ` +
      `${intruders === 1 ? 'intruso' : 'intrusos'} de origen desconocido.`,
    footer: 'Credenciales repartidas. Inicia el debate diurno — identifica y expulsa amenazas.',
    stats: [
      { label: 'Nodos en línea', value: String(brief.nodeCount) },
      { label: 'Defensores estimados', value: String(brief.systemCount) },
      { label: 'Amenazas activas', value: String(threats) },
    ],
  };
}
