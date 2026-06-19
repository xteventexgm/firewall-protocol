import { PrivateResultPayload } from '../types/events.types';
import { ROLE_NIGHT_ACTIONS } from '../types/player-metadata.types';
import { ROLE_CATALOG, RoleName, Team } from '../types/roles.types';

const TEAM_LABELS: Record<Team, string> = {
  [Team.SYSTEM]: 'Equipo Sistema (Blue Team)',
  [Team.BLACK_HAT]: 'Equipo Hacker (Red Team)',
  [Team.CHAOTIC]: 'Equipo Caótico',
};

const NIGHT_ACTION_HINTS: Record<string, string> = {
  scan: 'Cada noche escanea un jugador. Recibirás SEGURO o MALICIOSO (Rootkit siempre aparece como seguro).',
  protect: 'Cada noche protege a un jugador: bloquea un intento de eliminación sobre él. No repitas el mismo objetivo dos noches seguidas.',
  cure: 'Cura la infección de un jugador (Gusano u otra fuente). No repitas el mismo objetivo dos noches seguidas.',
  pentester_kill: 'Elimina a un jugador de noche (2 usos en total). Si matas a un aliado del Sistema, tú también caes.',
  freeze: 'Congela a un jugador: sus acciones nocturnas de esa noche no surten efecto.',
  bgp_swap: 'Intercambia el destino de dos jugadores para redirigir ataques nocturnos entre ellos.',
  honeypot_drag: 'Marca a un jugador cada noche. Si te eliminan, arrastras contigo a quien hayas marcado.',
  hacker_vote: 'Vota con el equipo hacker a quién eliminar. Hace falta mayoría simple entre los hackers vivos.',
  ransomware: 'Silencia a un jugador hasta el día siguiente: no podrá actuar de noche ni votar de día.',
  spy: 'Espía a un jugador y descubre quién lo visitó esa noche.',
  phisher_redirect: 'Redirige el voto diurno de un jugador hacia otro objetivo (fase VOTACION).',
  worm_infect: 'Infecta a un jugador: morirá al resolver la siguiente noche si no lo curan. Eres inmune a cualquier eliminación mientras vivas.',
  worm_kill: 'Alias de worm_infect: infecta al objetivo en lugar de eliminarlo al instante.',
  zero_day_assume: 'Asume el rol de un jugador ya eliminado (el objetivo debe estar muerto).',
};

const PASSIVE_NIGHT_HINT =
  'No tienes acción nocturna. Participa en el debate diurno y en las votaciones.';

export function buildRoleAssignedPayload(role: RoleName, team?: Team): PrivateResultPayload {
  const catalog = ROLE_CATALOG[role];
  const resolvedTeam = team ?? catalog.team;
  const nightActions = ROLE_NIGHT_ACTIONS[role];
  const nightAction = nightActions?.[0] ?? null;

  let nightActionHint = nightAction ? NIGHT_ACTION_HINTS[nightAction] ?? PASSIVE_NIGHT_HINT : PASSIVE_NIGHT_HINT;
  if (role === RoleName.ANTIVIRUS) {
    nightActionHint =
      'Una sola acción por noche: protect (bloquea un kill) O cure (cura infección), nunca ambas. Puedes cambiar tu elección antes de que termine la noche. No repitas el mismo objetivo dos noches seguidas por acción.';
  }
  if (role === RoleName.WORM) {
    nightActionHint = NIGHT_ACTION_HINTS.worm_infect;
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
