/**
 * Textos de rol para el móvil (`privateResult` type `role_assigned`).
 *
 * Combina catálogo (`ROLE_CATALOG`), acciones nocturnas y hints en español
 * alineados con mecánicas reales del RuleEngine.
 */
import { PrivateResultPayload } from '../types/events.types';
import { ROLE_NIGHT_ACTIONS } from '../types/player-metadata.types';
import { ROLE_CATALOG, RoleName, Team } from '../types/roles.types';

const TEAM_LABELS: Record<Team, string> = {
  [Team.SYSTEM]: 'Equipo Sistema (Blue Team)',
  [Team.BLACK_HAT]: 'Equipo Hacker (Red Team)',
  [Team.CHAOTIC]: 'Equipo Caótico',
};

const NIGHT_ACTION_HINTS: Record<string, string> = {
  scan: 'Correlacionas eventos sobre un nodo: SEGURO (alineado al Sistema), SOSPECHOSO (comportamiento anómalo / caótico) o MALICIOSO (amenaza confirmada). El Rootkit siempre aparece como SEGURO.',
  protect: 'Bloquea un intento de eliminación dirigido al objetivo esta noche. No repitas el mismo nodo dos noches seguidas.',
  cure: 'Remedia una infección activa (p. ej. Gusano). No repitas el mismo nodo dos noches seguidas.',
  pentester_kill: 'Exploit autorizado: eliminas a un jugador de noche (usos según tamaño de sala). Si eliminas a un aliado del Sistema, tú también caes.',
  freeze: 'Aislamiento de endpoint: el objetivo no ejecuta acciones nocturnas esta ronda (contención EDR).',
  bgp_swap: 'Mitigación de enrutamiento: intercambias el destino de dos nodos para desviar ataques nocturnos entre ellos.',
  honeypot_drag: 'Despliegas un señuelo sobre un nodo. Si caes en un ataque nocturno, arrastras contigo a quien marcaste (ignora protección Antivirus).',
  hacker_vote: 'Votas el objetivo de la campaña nocturna con el equipo hacker (mayoría simple).',
  ddos_vote: 'Tu voto en el consenso hacker cuenta doble. Si hay consenso, el objetivo queda degradado (silenciado al día siguiente) aunque sobreviva.',
  ransomware: 'Cifras operaciones del objetivo: no actúa de noche ni vota al día siguiente. Enfriamiento tras cada uso según tamaño de sala.',
  spy: 'Interceptas conexiones hacia el objetivo: ves qué nodos lo visitaron y el tipo de actividad (sin revelar roles).',
  phisher_redirect: 'Ingeniería social: rediriges el voto diurno de un jugador hacia otro objetivo (fase VOTACION).',
  worm_infect: 'Propagación autónoma: infectas a un nodo; caerá tras dos noches sin cura. Tu primera eliminación nocturna falla (inmunidad de persistencia); luego eres vulnerable.',
  worm_kill: 'Alias de worm_infect.',
  zero_day_assume: 'Exploit 0-day (una vez por partida): asumes el rol de un jugador ya eliminado y heredas sus habilidades. Los escaneos SOC reflejan tu rol asumido.',
};

const PASSIVE_NIGHT_HINT =
  'No tienes acción nocturna. Participa en el debate diurno y en las votaciones.';

/** Construye payload de asignación de rol (inicio de partida o Zero-Day asume). */
export function buildRoleAssignedPayload(role: RoleName, team?: Team): PrivateResultPayload {
  const catalog = ROLE_CATALOG[role];
  const resolvedTeam = team ?? catalog.team;
  const nightActions = ROLE_NIGHT_ACTIONS[role];
  const nightAction = nightActions?.[0] ?? null;

  let nightActionHint = nightAction ? NIGHT_ACTION_HINTS[nightAction] ?? PASSIVE_NIGHT_HINT : PASSIVE_NIGHT_HINT;
  if (role === RoleName.ANTIVIRUS) {
    nightActionHint =
      'EDR del Sistema — una acción por noche: protect (bloquea un kill sobre el objetivo) O cure (limpia infección), nunca ambas. No repitas el mismo nodo dos noches seguidas con la misma acción.';
  }
  if (role === RoleName.WORM) {
    nightActionHint = NIGHT_ACTION_HINTS.worm_infect;
  }
  if (role === RoleName.DDOS) {
    nightActionHint = NIGHT_ACTION_HINTS.ddos_vote;
  }
  if (role === RoleName.CRYPTO_MINER) {
    nightActionHint =
      'Cryptojacking pasivo: sin acción nocturna. Tienes capas de resistencia a kills directos (según tamaño de sala); las infecciones maduras sí pueden eliminarte. Ganas si eres el único jugador vivo.';
  }

  return {
    type: 'role_assigned',
    role,
    team: resolvedTeam,
    displayName: catalog.displayName,
    description: catalog.playerGuide ?? catalog.description ?? '',
    teamLabel: TEAM_LABELS[resolvedTeam],
    nightAction,
    nightActionHint,
  };
}
