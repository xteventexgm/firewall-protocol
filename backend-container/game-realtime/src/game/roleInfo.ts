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
  [Team.SYSTEM]: 'Equipo Sistema',
  [Team.BLACK_HAT]: 'Equipo Hacker',
  [Team.CHAOTIC]: 'Equipo Caótico',
};

const NIGHT_ACTION_HINTS: Record<string, string> = {
  scan: 'De noche señalas a alguien. Solo tú recibes si parece confiable, sospechoso o peligroso.',
  protect: 'De noche eliges a alguien para que no lo eliminen esa noche.',
  cure: 'De noche quitas la infección de alguien (por ejemplo, si lo atacó el Gusano).',
  pentester_kill: 'De noche intentas eliminar a alguien (1 o 2 veces según jugadores). Si eliminas a un aliado, tú también caes.',
  freeze: 'De noche bloqueas a alguien para que no pueda hacer nada hasta el amanecer.',
  bgp_swap: 'De noche intercambias a dos jugadores: los ataques contra uno van al otro.',
  honeypot_drag: 'De noche marcas a alguien. Si te eliminan, él cae contigo.',
  hacker_vote: 'De noche votas con los hackers a quién eliminar. Gana quien tenga más votos.',
  ddos_vote: 'Tu voto cuenta doble. Si el objetivo sobrevive, queda sin hablar ni votar al día siguiente.',
  ransomware: 'De noche callas a alguien: no actúa ni vota al día siguiente. Luego debes esperar unas noches.',
  spy: 'De noche espías a alguien. Al amanecer ves quién lo visitó (sin saber roles exactos).',
  phisher_redirect: 'De noche engañas a alguien: en la próxima votación su voto irá a otra persona que elijas.',
  worm_infect: 'De noche infectas a alguien: muere en dos noches si nadie lo cura. La primera vez que intenten matarte, sobrevives.',
  worm_kill: 'De noche infectas a alguien para que muera en un par de noches si no lo curan.',
  zero_day_assume: 'Una vez por partida copias el rol de alguien ya eliminado.',
  troll_provoke: 'De noche dejas un mensaje anónimo que todos leerán al amanecer.',
  mine_crypto: 'De noche ganas un escudo extra (máximo 3).',
  crypto_bribe: 'Gastas 1 escudo para intentar eliminar a alguien esa noche.',
  ids_watch: 'De noche vigias a alguien. Si lo atacan, recibes una alerta.',
  patch_harden: 'De noche proteges a alguien del voto conjunto de los hackers (otros ataques sí pueden matarlo).',
  forensic_trace: 'De noche investigas a alguien y ves quién murió la noche anterior.',
  brute_force: 'Una sola vez en la partida intentas eliminar a alguien de noche.',
  team_probe: 'De noche descubres si alguien es del bando bueno, hacker o caótico (no su rol exacto).',
  exploit_strip: 'De noche anulas la protección del Antivirus sobre alguien.',
  data_leak: 'De noche revelas el bando de alguien en el chat público al amanecer (sin decir quién eres).',
  shadow_mask: 'De noche haces que alguien parezca inocente si lo investigan.',
  logic_bomb: 'De noche pones una trampa: si esa persona actúa la noche siguiente, muere.',
  backup_mark: 'Una vez por partida salvas a alguien de morir esa noche.',
  threat_hunt: 'De noche investigas a alguien: te dice si es una amenaza o parece limpio.',
  incident_clear: 'De noche quitas silencios y bloqueos de voto a alguien.',
  waf_block: 'De noche evitas que el Gusano infecte a alguien.',
  intel_pulse: 'Una vez por partida ves cuántos jugadores vivos hay de cada bando.',
  ally_verify: 'De noche compruebas si alguien es de tu mismo equipo (sí o no).',
  backdoor_plant: 'De noche refuerzas el voto de los hackers contra alguien.',
  lateral_probe: 'De noche compruebas si alguien es del bando bueno (sí o no).',
  vote_trace: 'De noche ves a quién votó alguien en la última votación.',
  vuln_scan: 'De noche ves si alguien está infectado o silenciado.',
  cred_probe: 'De noche descubres si alguien tiene un rol muy importante de defensa.',
  mitm_hijack: 'De noche haces que un hacker vote contra alguien que elijas.',
  dns_spoof: 'De noche confundes a alguien: en la próxima votación su voto va a otra persona al azar.',
  rigged_payload: 'De noche preparas un sabotaje para la próxima noche y ganas un escudo.',
  jam_hacker: 'De noche te proteges: pareces inocente, los hackers no pueden matarte por voto y sobrevives un linchamiento.',
  chaos_route: 'De noche rediriges los ataques de alguien hacia otra persona.',
  ransom_note: 'De noche silencias a alguien y publicas una nota anónima.',
  noise_burst: 'De noche publicas un mensaje anónimo de confusión al amanecer.',
  mirage_cloak: 'De noche te camuflas para parecer inocente si te investigan.',
};

const PASSIVE_NIGHT_HINT =
  'No tienes poder de noche. Habla y vota de día para ayudar a tu equipo.';

const TEAM_VICTORY_HINTS: Record<Team, string> = {
  [Team.SYSTEM]:
    'Gana tu equipo si eliminan a todos los hackers y caóticos, y queda al menos un defensor vivo.',
  [Team.BLACK_HAT]:
    'Gana tu equipo si eliminan a todos los del bando bueno. Si quedan caóticos, debéis ser más numerosos que ellos.',
  [Team.CHAOTIC]: 'Tu forma de ganar depende de tu rol caótico (léelo abajo).',
};

const ROLE_VICTORY_HINTS: Partial<Record<RoleName, string>> = {
  [RoleName.TROLL]: 'Ganas si te expulsan votando de día.',
  [RoleName.WORM]: 'Ganas si eres el único jugador vivo al final.',
  [RoleName.CRYPTO_MINER]: 'Ganas si eres el único jugador vivo al final.',
  [RoleName.ZERO_DAY]: 'Ganas con las mismas reglas del rol que copies.',
  [RoleName.SYSADMIN]: 'Ganas con el bando bueno: sin hackers ni caóticos vivos.',
};

/** Descripción corta en lenguaje cotidiano (sin jerga técnica). */
const ROLE_PLAIN_DESCRIPTION: Partial<Record<RoleName, string>> = {
  [RoleName.SYSADMIN]: 'Diriges la red. Tu equipo gana eliminando a hackers y caóticos.',
  [RoleName.SOC_ANALYST]: 'Investigas quién es sospechoso. Ayudas al bando bueno a encontrar enemigos.',
  [RoleName.ANTIVIRUS]: 'Proteges y curas. Eres la defensa directa contra ataques e infecciones.',
  [RoleName.PENTESTER]: 'Puedes eliminar a alguien de noche con permiso, pero cuidado con matar aliados.',
  [RoleName.HONEYPOT]: 'Si te eliminan, te llevas contigo a quien hayas marcado.',
  [RoleName.DEEP_FREEZE]: 'Congelas a alguien para que no actúe de noche.',
  [RoleName.BGP_ROUTER]: 'Intercambias objetivos para confundir ataques nocturnos.',
  [RoleName.IDS]: 'Vigilas a alguien y te avisan si lo atacan.',
  [RoleName.PATCH_MANAGER]: 'Refuerzas a un compañero para que los hackers no lo maten por voto conjunto.',
  [RoleName.FORENSIC_ANALYST]: 'Investigas muertes recientes para encontrar pistas.',
  [RoleName.BACKUP_NODE]: 'Una vez por partida evitas que alguien muera esa noche.',
  [RoleName.DDOS]: 'Votas con los hackers; tu voto cuenta doble.',
  [RoleName.ROOTKIT]: 'Votas con los hackers y pareces inocente en las investigaciones.',
  [RoleName.RANSOMWARE]: 'Silencias a alguien para que no actúe ni vote al día siguiente.',
  [RoleName.SPYWARE]: 'Espías visitas nocturnas hacia alguien.',
  [RoleName.PHISHER]: 'Manipulas el voto diurno de otra persona.',
  [RoleName.WORM]: 'Infectas y quieres quedar solo al final.',
  [RoleName.TROLL]: 'Quieres que te expulsen votando: ganas perdiendo.',
  [RoleName.CRYPTO_MINER]: 'Acumulas escudos y quieres sobrevivir solo al final.',
};

function victoryHintFor(role: RoleName, team: Team): string {
  return ROLE_VICTORY_HINTS[role] ?? TEAM_VICTORY_HINTS[team];
}

/** Construye payload de asignación de rol (inicio de partida o Zero-Day asume). */
export function buildRoleAssignedPayload(role: RoleName, team?: Team): PrivateResultPayload {
  const catalog = ROLE_CATALOG[role];
  const resolvedTeam = team ?? catalog.team;
  const nightActions = ROLE_NIGHT_ACTIONS[role];
  const nightAction =
    nightActions?.find((a) => a !== 'hacker_vote') ?? nightActions?.[0] ?? null;

  let nightActionHint = nightAction ? NIGHT_ACTION_HINTS[nightAction] ?? PASSIVE_NIGHT_HINT : PASSIVE_NIGHT_HINT;
  if (role === RoleName.ANTIVIRUS) {
    nightActionHint =
      'Cada noche eliges: proteger a alguien de un ataque O quitar una infección. No repitas al mismo jugador dos noches seguidas.';
  }
  if (role === RoleName.WORM) {
    nightActionHint = NIGHT_ACTION_HINTS.worm_infect;
  }
  if (role === RoleName.DDOS) {
    nightActionHint = NIGHT_ACTION_HINTS.ddos_vote;
  }
  if (role === RoleName.CRYPTO_MINER) {
    nightActionHint =
      'Cada noche minas (+1 escudo, máx. 3) O gastas 1 escudo para intentar matar a alguien. Ganas si eres el único vivo.';
  }
  if (role === RoleName.SYSADMIN) {
    nightActionHint =
      'Sin acción de noche. Una vez por partida, en votación, puedes anular el voto de alguien.';
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

  const hasHackerVote = nightActions?.includes('hacker_vote');
  const hasOtherAbility = nightActions?.some((a) => a !== 'hacker_vote');
  if (resolvedTeam === Team.BLACK_HAT && hasHackerVote && hasOtherAbility) {
    nightActionHint = `${nightActionHint} También votas cada noche con los hackers a quién eliminar.`;
  }

  const roleDescription =
    ROLE_PLAIN_DESCRIPTION[role] ??
    catalog.description ??
    catalog.displayName;

  return {
    type: 'role_assigned',
    role,
    team: resolvedTeam,
    displayName: catalog.displayName,
    description: formatRoleCopy(roleDescription),
    teamLabel: TEAM_LABELS[resolvedTeam],
    nightAction,
    nightActionHint: formatRoleCopy(nightActionHint),
    victoryHint: formatRoleCopy(victoryHintFor(role, resolvedTeam)),
  };
}
