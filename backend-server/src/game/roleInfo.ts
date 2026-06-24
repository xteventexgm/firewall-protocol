/**
 * Textos de rol para el móvil (`privateResult` type `role_assigned`).
 *
 * Combina catálogo (`ROLE_CATALOG`), acciones nocturnas y hints en español
 * alineados con mecánicas reales del RuleEngine.
 */
import { PrivateResultPayload } from '../types/events.types';
import { ROLE_NIGHT_ACTIONS } from '../types/player-metadata.types';
import { ROLE_CATALOG, RoleName, Team } from '../types/roles.types';
import { formatRoleCopy } from '../utils/roleCopy';

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
  troll_provoke: 'Deja un mensaje anónimo en el feed público del amanecer. Elige tu provocación con cuidado.',
  mine_crypto: 'Cryptojacking sigiloso: parasitizas el procesamiento de un nodo y ganas +1 escudo (máx. 3 acumulables). La víctima no recibe aviso.',
  crypto_bribe: 'Soborno letal: gastas 1 escudo para eliminar directamente a un objetivo (kill directo, sujeto a protect). Requiere al menos 1 escudo.',
  ids_watch: 'Vigilas un nodo. Si recibe visitas hostiles esa noche, recibes alerta privada con el conteo (sin roles).',
  patch_harden: 'El objetivo no puede morir por consenso hacker esta noche (kills directos sí aplican).',
  forensic_trace: 'Recibes bajas de la última noche por bando y si tu objetivo estuvo entre las víctimas.',
  brute_force: 'Kill directo único por partida (1 uso). Sujeto a protect, honeypot y escudos.',
  team_probe: 'Sondeas un nodo vivo y recibes su equipo (System / Black Hat / Caótico), no el rol exacto.',
  exploit_strip: 'El protect del Antivirus no aplica sobre el objetivo esta noche.',
  data_leak: 'Filtras el equipo de un jugador al feed público de forma anónima al amanecer.',
  shadow_mask: 'Un jugador aparece como SEGURO en escaneos SOC esta noche.',
  logic_bomb: 'Armas una bomba: si el objetivo actúa la noche siguiente, muere antes de resolver su acción.',
  backup_mark: '1×/partida: el objetivo sobrevive un kill esta noche (se consume el respaldo).',
  threat_hunt: 'AMENAZA o LIMPIO — sin rol exacto.',
  incident_clear: 'Elimina silencio de Ransomware/DDoS y bloqueos de voto activos.',
  waf_block: 'Bloquea infección de Gusano sobre el objetivo esta noche.',
  intel_pulse: '1×/partida: conteo privado de vivos por bando.',
  integrity_check: '¿El objetivo es del bando System? (sí/no).',
  ally_verify: '¿El objetivo pertenece a tu mismo bando? (sí/no).',
  backdoor_plant: '+1 peso en consenso hacker contra el objetivo esta noche.',
  lateral_probe: '¿El objetivo es System? (sí/no).',
  vote_trace: 'A quién votó el objetivo en la última votación.',
  vuln_scan: '¿Está infectado o silenciado? (comprometido sí/no).',
  cred_probe: 'DEFENSA_CRÍTICA o PERFIL_ESTÁNDAR según rol defensivo.',
  mitm_hijack: 'Fuerzas el voto nocturno de un hacker hacia tu objetivo.',
  dns_spoof: 'Envenenas el resolver DNS: el voto del objetivo se desvía al azar en la próxima votación (siempre hacia otro nodo distinto al que eligió). Tú apareces SEGURO en escaneos SOC esta noche.',
  rigged_payload: 'La próxima noche el objetivo ignora protect, cure y respaldo. Ganas +1 escudo caótico (máx. 2; empiezas con 1).',
  jam_hacker: 'Jammeas tu propia señal: SEGURO en SOC, inmune al consenso hacker esta noche y sobrevives un linchamiento mañana.',
  chaos_route: 'Desvías ataques del origen hacia un colateral (unidireccional, no intercambio BGP).',
  ransom_note: 'Silencia al objetivo y publica nota de rescate anónima.',
  noise_burst: 'Mensaje anónimo de ruido en el feed público.',
  mirage_cloak: 'Te enmascaras como SEGURO en escaneos SOC esta noche.',
};

const PASSIVE_NIGHT_HINT =
  'No tienes acción nocturna. Participa en el debate diurno y en las votaciones.';

const TEAM_VICTORY_HINTS: Record<Team, string> = {
  [Team.SYSTEM]:
    'Victoria del Sistema: 0 hackers vivos, 0 caóticos vivos y al menos 1 defensor System en pie.',
  [Team.BLACK_HAT]:
    'Victoria Black Hat: 0 jugadores System vivos; si quedan caóticos, debes superarlos en número (hackers > caóticos).',
  [Team.CHAOTIC]: 'Victoria según tu rol caótico — revisa tu condición especial abajo.',
};

const ROLE_VICTORY_HINTS: Partial<Record<RoleName, string>> = {
  [RoleName.TROLL]: 'Victoria solitaria: ser expulsado por votación diurna (te banean).',
  [RoleName.WORM]: 'Victoria solitaria: quedar como único jugador vivo.',
  [RoleName.CRYPTO_MINER]: 'Victoria solitaria: quedar como único jugador vivo.',
  [RoleName.ZERO_DAY]: 'Hereda la victoria del rol que asumas con zero_day_assume.',
  [RoleName.SYSADMIN]: 'Victoria del Sistema: 0 hackers y 0 caóticos vivos.',
};

function victoryHintFor(role: RoleName, team: Team): string {
  return ROLE_VICTORY_HINTS[role] ?? TEAM_VICTORY_HINTS[team];
}

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
      'Economía cripto — una acción por noche: mine_crypto (minar +1 escudo, máx. 3) O crypto_bribe (gasta 1 escudo → kill directo). Los escudos bloquean ataques directos; infección madura te elimina. Ganas si eres el único jugador vivo.';
  }
  if (role === RoleName.SYSADMIN) {
    nightActionHint =
      'Sin acción nocturna. Durante VOTACION puedes usar Parche de emergencia (1×/partida) para anular el voto de un jugador.';
  }
  if (role === RoleName.TROLL) {
    nightActionHint = NIGHT_ACTION_HINTS.troll_provoke;
  }
  if (role === RoleName.WHITE_NOISE) {
    nightActionHint = NIGHT_ACTION_HINTS.noise_burst;
  }
  if (role === RoleName.DNS_POISONER) {
    nightActionHint = NIGHT_ACTION_HINTS.dns_spoof;
  }
  if (role === RoleName.DROPPER) {
    nightActionHint = NIGHT_ACTION_HINTS.rigged_payload;
  }
  if (role === RoleName.SABOTEUR) {
    nightActionHint = NIGHT_ACTION_HINTS.jam_hacker;
  }
  if (role === RoleName.CHAOS_ROUTER) {
    nightActionHint = NIGHT_ACTION_HINTS.chaos_route;
  }
  if (role === RoleName.INTEGRITY_MONITOR) {
    nightActionHint = NIGHT_ACTION_HINTS.ally_verify;
  }
  if (role === RoleName.MIRAGE) {
    nightActionHint = NIGHT_ACTION_HINTS.mirage_cloak;
  }
  if (role === RoleName.MITM_PROXY) {
    nightActionHint = NIGHT_ACTION_HINTS.mitm_hijack;
  }

  return {
    type: 'role_assigned',
    role,
    team: resolvedTeam,
    displayName: catalog.displayName,
    description: formatRoleCopy(catalog.playerGuide ?? catalog.description ?? ''),
    teamLabel: TEAM_LABELS[resolvedTeam],
    nightAction,
    nightActionHint: formatRoleCopy(nightActionHint),
    victoryHint: formatRoleCopy(victoryHintFor(role, resolvedTeam)),
  };
}
