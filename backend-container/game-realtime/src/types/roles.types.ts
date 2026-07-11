/**
 * Catálogo de roles, equipos y textos orientados al jugador (`playerGuide`).
 *
 * 44 roles en tres bandos: System (16), Black Hat (14), Caótico (14).
 */
export enum Team {
  SYSTEM = 'system',
  BLACK_HAT = 'black_hat',
  CHAOTIC = 'chaotic',
}

export enum RoleName {
  // System (Blue Team)
  SYSADMIN = 'SysAdmin',
  SOC_ANALYST = 'Analista SOC',
  ANTIVIRUS = 'Antivirus',
  PENTESTER = 'Pentester',
  HONEYPOT = 'Honeypot',
  DEEP_FREEZE = 'Deep Freeze',
  BGP_ROUTER = 'Enrutador BGP',
  IDS = 'Detector IDS',
  PATCH_MANAGER = 'Parcheador',
  FORENSIC_ANALYST = 'Analista Forense',
  BACKUP_NODE = 'Nodo de Respaldo',
  THREAT_HUNTER = 'Cazador de Amenazas',
  INCIDENT_RESPONDER = 'Respondedor de Incidentes',
  WAF = 'Cortafuegos WAF',
  THREAT_INTEL = 'Intel de Amenazas',
  INTEGRITY_MONITOR = 'Monitor de Integridad',

  // Black Hat (Red Team)
  DDOS = 'DDoS Operator',
  ROOTKIT = 'Rootkit',
  RANSOMWARE = 'Ransomware',
  SPYWARE = 'Spyware',
  PHISHER = 'Phisher',
  BRUTE_FORCE = 'Fuerza Bruta',
  SNIFFER = 'Sniffer',
  EXPLOIT_KIT = 'Kit de Exploits',
  BACKDOOR_IMPLANT = 'Implante Backdoor',
  LATERAL_MOVE = 'Movimiento Lateral',
  KEYLOGGER = 'Keylogger',
  VULN_SCANNER = 'Escáner de Vulnerabilidades',
  CREDENTIAL_STEALER = 'Robador de Credenciales',
  MITM_PROXY = 'Proxy MitM',

  // Chaotic
  TROLL = 'Troll',
  WORM = 'Gusano',
  CRYPTO_MINER = 'Minero de Cripto',
  ZERO_DAY = 'Zero-Day',
  DATA_LEAKER = 'Filtrador',
  SHADOW = 'Sombra',
  LOGIC_BOMB = 'Bomba Lógica',
  DNS_POISONER = 'Envenenador DNS',
  RANSOM_NOTE = 'Nota de Rescate',
  DROPPER = 'Dropper',
  SABOTEUR = 'Saboteador',
  WHITE_NOISE = 'Ruido Blanco',
  MIRAGE = 'Espejismo',
  CHAOS_ROUTER = 'Router del Caos',
}

const SYSTEM_WIN =
  'Victoria del Sistema: 0 hackers vivos, 0 caóticos vivos y al menos 1 defensor System en pie.';
const BLACK_HAT_WIN =
  'Victoria Black Hat: 0 jugadores System vivos; si quedan caóticos, debes superarlos en número (hackers > caóticos).';

export interface Role {
  id: RoleName;
  team: Team;
  displayName: string;
  description?: string;
  /** Texto orientado al jugador (móvil). */
  playerGuide?: string;
  priority?: number;
}

export const ROLE_CATALOG: Record<RoleName, Role> = {
  [RoleName.SYSADMIN]: {
    id: RoleName.SYSADMIN,
    team: Team.SYSTEM,
    displayName: 'SysAdmin',
    description: 'Administrador del sistema',
    playerGuide:
      'Sin acción por la noche. Durante el día, puedes usar tu Parche de emergencia (1 vez por partida): eliges a un jugador y su voto no contará para expulsar a nadie. ' +
      SYSTEM_WIN,
    priority: 50,
  },
  [RoleName.SOC_ANALYST]: {
    id: RoleName.SOC_ANALYST,
    team: Team.SYSTEM,
    displayName: 'Analista SOC',
    description: 'Investigador de jugadores',
    playerGuide:
      'Cada noche puedes investigar a un jugador. Recibirás un reporte secreto: SEGURO, SOSPECHOSO o MALICIOSO. ' +
      'Ojo: algunos roles avanzados pueden burlar tu escaneo. ' +
      SYSTEM_WIN,
    priority: 40,
  },
  [RoleName.ANTIVIRUS]: {
    id: RoleName.ANTIVIRUS,
    team: Team.SYSTEM,
    displayName: 'Antivirus',
    description: 'Protege o cura aliados',
    playerGuide:
      'Cada noche puedes elegir una acción: Proteger a alguien de ser eliminado, o Curar a alguien de una infección. ' +
      'No puedes elegir a la misma persona dos noches seguidas con la misma acción. ' +
      SYSTEM_WIN,
    priority: 60,
  },
  [RoleName.PENTESTER]: {
    id: RoleName.PENTESTER,
    team: Team.SYSTEM,
    displayName: 'Pentester',
    description: 'Atacante aliado',
    playerGuide:
      'Puedes eliminar a un jugador por la noche (usos limitados según el tamaño de la sala). ' +
      '¡Ten cuidado! Si eliminas a un jugador de tu propio bando, tú también serás eliminado por el sistema. ' +
      SYSTEM_WIN,
    priority: 30,
  },
  [RoleName.HONEYPOT]: {
    id: RoleName.HONEYPOT,
    team: Team.SYSTEM,
    displayName: 'Honeypot',
    description: 'Trampa mortal',
    playerGuide:
      'Cada noche marcas a un jugador como tu trampa. Si los hackers te eliminan a ti esa noche, la persona que marcaste será eliminada junto contigo, sin importar si estaba protegida. ' +
      SYSTEM_WIN,
    priority: 20,
  },
  [RoleName.DEEP_FREEZE]: {
    id: RoleName.DEEP_FREEZE,
    team: Team.SYSTEM,
    displayName: 'Deep Freeze',
    description: 'Congela turnos nocturnos',
    playerGuide:
      'Cada noche congelas a un jugador. Todas las acciones que intente hacer esa noche serán canceladas. ' +
      SYSTEM_WIN,
    priority: 70,
  },
  [RoleName.BGP_ROUTER]: {
    id: RoleName.BGP_ROUTER,
    team: Team.SYSTEM,
    displayName: 'Enrutador BGP',
    description: 'Intercambia destinos',
    playerGuide:
      'Cada noche intercambias a dos jugadores. Cualquier acción nocturna dirigida al primero, afectará al segundo, y viceversa. ' +
      SYSTEM_WIN,
    priority: 35,
  },
  [RoleName.IDS]: {
    id: RoleName.IDS,
    team: Team.SYSTEM,
    displayName: 'Detector IDS',
    description: 'Vigila a un jugador',
    playerGuide:
      'Vigilas a un jugador cada noche. Si alguien más lo visita para atacarlo o afectarlo, recibirás una alerta secreta indicando cuántas visitas tuvo (pero no quiénes fueron). ' +
      SYSTEM_WIN,
    priority: 38,
  },
  [RoleName.PATCH_MANAGER]: {
    id: RoleName.PATCH_MANAGER,
    team: Team.SYSTEM,
    displayName: 'Parcheador',
    description: 'Inmunidad al voto hacker',
    playerGuide:
      'Eliges a un jugador cada noche. Esa persona no podrá ser eliminada por la votación grupal de los hackers (pero sí por ataques letales individuales). ' +
      SYSTEM_WIN,
    priority: 42,
  },
  [RoleName.FORENSIC_ANALYST]: {
    id: RoleName.FORENSIC_ANALYST,
    team: Team.SYSTEM,
    displayName: 'Analista Forense',
    description: 'Rastreador de víctimas',
    playerGuide:
      'Eliges a un jugador y recibes un reporte de la noche anterior: sabrás de qué bando eran las víctimas y si el jugador que elegiste estuvo involucrado en ellas. ' +
      SYSTEM_WIN,
    priority: 33,
  },
  [RoleName.BACKUP_NODE]: {
    id: RoleName.BACKUP_NODE,
    team: Team.SYSTEM,
    displayName: 'Nodo de Respaldo',
    description: 'Otorga una vida extra',
    playerGuide:
      'Una vez por partida, marcas a un jugador. Si iba a ser eliminado por un ataque esa noche, sobrevive gastando el respaldo. ' +
      SYSTEM_WIN,
    priority: 36,
  },
  [RoleName.THREAT_HUNTER]: {
    id: RoleName.THREAT_HUNTER,
    team: Team.SYSTEM,
    displayName: 'Cazador de Amenazas',
    description: 'Detector de enemigos',
    playerGuide:
      'Investigas a un jugador de noche. Sabrás si es una AMENAZA o si está LIMPIO. ' +
      SYSTEM_WIN,
    priority: 37,
  },
  [RoleName.INCIDENT_RESPONDER]: {
    id: RoleName.INCIDENT_RESPONDER,
    team: Team.SYSTEM,
    displayName: 'Respondedor de Incidentes',
    description: 'Quita el silencio',
    playerGuide:
      'Si un jugador fue silenciado (no puede votar ni hablar), lo liberas para que pueda actuar normalmente al día siguiente. ' +
      SYSTEM_WIN,
    priority: 41,
  },
  [RoleName.WAF]: {
    id: RoleName.WAF,
    team: Team.SYSTEM,
    displayName: 'Cortafuegos WAF',
    description: 'Bloquea infecciones',
    playerGuide:
      'Eliges a un jugador cada noche. Nadie podrá infectarlo esa noche (pero los ataques letales sí le afectarán). ' +
      SYSTEM_WIN,
    priority: 39,
  },
  [RoleName.THREAT_INTEL]: {
    id: RoleName.THREAT_INTEL,
    team: Team.SYSTEM,
    displayName: 'Intel de Amenazas',
    description: 'Conoce a los enemigos vivos',
    playerGuide:
      'Una vez por partida, revelas el conteo exacto de cuántos atacantes, entidades anómalas y defensores siguen vivos en la red. ' +
      SYSTEM_WIN,
    priority: 34,
  },
  [RoleName.INTEGRITY_MONITOR]: {
    id: RoleName.INTEGRITY_MONITOR,
    team: Team.SYSTEM,
    displayName: 'Monitor de Integridad',
    description: 'Verifica lealtad',
    playerGuide:
      'Cada noche compruebas si un jugador comparte tus mismos objetivos de victoria o no. Útil para encontrar aliados en secreto. ' +
      SYSTEM_WIN,
    priority: 32,
  },

  [RoleName.DDOS]: {
    id: RoleName.DDOS,
    team: Team.BLACK_HAT,
    displayName: 'DDoS Operator',
    description: 'Voto doble hacker',
    playerGuide:
      'Participas en la votación nocturna con los demás hackers. ¡Tu voto vale doble! ' +
      'Si logran mayoría y el jugador no es eliminado, quedará silenciado al día siguiente. Conoces quiénes son los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 25,
  },
  [RoleName.ROOTKIT]: {
    id: RoleName.ROOTKIT,
    team: Team.BLACK_HAT,
    displayName: 'Rootkit',
    description: 'Hacker invisible',
    playerGuide:
      'Participas en la votación nocturna con los demás hackers. Tienes una ventaja pasiva: las investigaciones siempre dirán que estás SEGURO. Conoces quiénes son los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 45,
  },
  [RoleName.RANSOMWARE]: {
    id: RoleName.RANSOMWARE,
    team: Team.BLACK_HAT,
    displayName: 'Ransomware',
    description: 'Silencia jugadores',
    playerGuide:
      'En lugar de votar con los hackers, puedes elegir silenciar a un jugador. Al día siguiente no podrá hablar ni votar. ' +
      'Tienes que esperar unas noches para volver a usarlo. Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 55,
  },
  [RoleName.SPYWARE]: {
    id: RoleName.SPYWARE,
    team: Team.BLACK_HAT,
    displayName: 'Spyware',
    description: 'Espía visitas',
    playerGuide:
      'En lugar de votar, eliges espiar a un jugador. Al día siguiente sabrás quiénes lo visitaron y qué tipo de acción le hicieron (pero no sus roles exactos). Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 15,
  },
  [RoleName.PHISHER]: {
    id: RoleName.PHISHER,
    team: Team.BLACK_HAT,
    displayName: 'Phisher',
    description: 'Control mental de votos',
    playerGuide:
      'En lugar de votar en la noche, puedes obligar a un jugador a que vote por quien tú decidas en la expulsión grupal del día siguiente. Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 10,
  },
  [RoleName.BRUTE_FORCE]: {
    id: RoleName.BRUTE_FORCE,
    team: Team.BLACK_HAT,
    displayName: 'Fuerza Bruta',
    description: 'Asesino a sueldo',
    playerGuide:
      'Una vez por partida, en lugar de unirte a la votación nocturna grupal, puedes intentar eliminar a un jugador por tu cuenta. Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 22,
  },
  [RoleName.SNIFFER]: {
    id: RoleName.SNIFFER,
    team: Team.BLACK_HAT,
    displayName: 'Sniffer',
    description: 'Identifica bandos',
    playerGuide:
      'En lugar de votar de noche, puedes investigar a un jugador. El sistema te revelará a qué bando pertenece de forma general. Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 18,
  },
  [RoleName.EXPLOIT_KIT]: {
    id: RoleName.EXPLOIT_KIT,
    team: Team.BLACK_HAT,
    displayName: 'Kit de Exploits',
    description: 'Rompe protecciones',
    playerGuide:
      'En lugar de votar de noche, puedes marcar a un jugador. Si alguna defensa intenta protegerlo esa misma noche, la protección fallará. Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 28,
  },
  [RoleName.BACKDOOR_IMPLANT]: {
    id: RoleName.BACKDOOR_IMPLANT,
    team: Team.BLACK_HAT,
    displayName: 'Implante Backdoor',
    description: 'Voto extra en contra',
    playerGuide:
      'En lugar de votar, puedes marcar a un jugador. Si el resto de los hackers votan por él, recibirán un punto de votación extra para asegurar su eliminación. Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 24,
  },
  [RoleName.LATERAL_MOVE]: {
    id: RoleName.LATERAL_MOVE,
    team: Team.BLACK_HAT,
    displayName: 'Movimiento Lateral',
    description: 'Detector de aliados',
    playerGuide:
      'En lugar de votar, investigas a un jugador. Sabrás si pertenece a la red de defensores o no. Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 17,
  },
  [RoleName.KEYLOGGER]: {
    id: RoleName.KEYLOGGER,
    team: Team.BLACK_HAT,
    displayName: 'Keylogger',
    description: 'Vigila votos pasados',
    playerGuide:
      'En lugar de votar de noche, puedes ver por quién votó un jugador en la expulsión del día anterior. Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 13,
  },
  [RoleName.VULN_SCANNER]: {
    id: RoleName.VULN_SCANNER,
    team: Team.BLACK_HAT,
    displayName: 'Escáner de Vulnerabilidades',
    description: 'Detecta debilitados',
    playerGuide:
      'En lugar de votar, investigas a un jugador. Sabrás si ese jugador está comprometido (infectado o silenciado). Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 19,
  },
  [RoleName.CREDENTIAL_STEALER]: {
    id: RoleName.CREDENTIAL_STEALER,
    team: Team.BLACK_HAT,
    displayName: 'Robador de Credenciales',
    description: 'Detecta roles críticos',
    playerGuide:
      'En lugar de votar, investigas a un jugador. Descubrirás si su perfil de sistema es una DEFENSA_CRÍTICA o un PERFIL_ESTÁNDAR. Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 21,
  },
  [RoleName.MITM_PROXY]: {
    id: RoleName.MITM_PROXY,
    team: Team.BLACK_HAT,
    displayName: 'Proxy MitM',
    description: 'Secuestra votos hackers',
    playerGuide:
      'En lugar de votar tú mismo, eliges a otro hacker y cambias su voto para que ataque a quien tú decidas. Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 11,
  },

  [RoleName.TROLL]: {
    id: RoleName.TROLL,
    team: Team.CHAOTIC,
    displayName: 'Troll',
    description: 'Victoria por expulsión',
    playerGuide:
      'Tu único objetivo es que los demás jugadores voten para expulsarte durante el día. Si lo logras, ganas la partida automáticamente. Por la noche puedes dejar un mensaje anónimo para engañar o molestar a los demás.',
    priority: 5,
  },
  [RoleName.WORM]: {
    id: RoleName.WORM,
    team: Team.CHAOTIC,
    displayName: 'Gusano',
    description: 'Infección progresiva',
    playerGuide:
      'Por la noche infectas a un jugador. Si no lo curan, será eliminado después de dos noches. Además, tienes inmunidad contra el primer ataque que te hagan por la noche. Ganas si quedas como el único jugador vivo.',
    priority: 28,
  },
  [RoleName.CRYPTO_MINER]: {
    id: RoleName.CRYPTO_MINER,
    team: Team.CHAOTIC,
    displayName: 'Minero de Cripto',
    description: 'Escudos y sobornos',
    playerGuide:
      'Cada noche puedes elegir: Minar (ganas un escudo protector, máximo 3 escudos, no puedes minar al mismo jugador dos noches seguidas) o Sobornar (gasta un escudo para eliminar a un jugador inmediatamente). Ganas si eres el último en pie.',
    priority: 12,
  },
  [RoleName.ZERO_DAY]: {
    id: RoleName.ZERO_DAY,
    team: Team.CHAOTIC,
    displayName: 'Zero-Day',
    description: 'Roba identidades muertas',
    playerGuide:
      'Una vez por partida, eliges a un jugador que ya fue eliminado y robas su rol, sus habilidades y su bando. A partir de ese momento, juegas como si fueras él. Las investigaciones mostrarán tu nuevo rol.',
    priority: 65,
  },
  [RoleName.DATA_LEAKER]: {
    id: RoleName.DATA_LEAKER,
    team: Team.CHAOTIC,
    displayName: 'Filtrador',
    description: 'Revela bandos',
    playerGuide:
      'Cada noche puedes elegir a un jugador y filtrar su afiliación de red. Esta información aparecerá anónimamente al amanecer para que todos la vean. Ganas generando caos y sobreviviendo hasta el final.',
    priority: 8,
  },
  [RoleName.SHADOW]: {
    id: RoleName.SHADOW,
    team: Team.CHAOTIC,
    displayName: 'Sombra',
    description: 'Disfraza a un aliado',
    playerGuide:
      'Eliges a un jugador cada noche. Si alguien lo investiga, aparecerá como SEGURO, ocultando su verdadera naturaleza. Tu propia identidad sigue oculta.',
    priority: 14,
  },
  [RoleName.LOGIC_BOMB]: {
    id: RoleName.LOGIC_BOMB,
    team: Team.CHAOTIC,
    displayName: 'Bomba Lógica',
    description: 'Trampa mortal',
    playerGuide:
      'Por la noche, colocas una trampa en un jugador. Si ese jugador usa una habilidad nocturna en el turno siguiente, explotará y será eliminado antes de poder hacer su acción.',
    priority: 16,
  },
  [RoleName.DNS_POISONER]: {
    id: RoleName.DNS_POISONER,
    team: Team.CHAOTIC,
    displayName: 'Envenenador DNS',
    description: 'Caos en los votos diurnos',
    playerGuide:
      'Eliges a un jugador por la noche. Al día siguiente, su voto de expulsión se desviará hacia una persona aleatoria sin que se dé cuenta. Además, tú apareces como SEGURO si te investigan en la misma noche en la que usas esto.',
    priority: 9,
  },
  [RoleName.RANSOM_NOTE]: {
    id: RoleName.RANSOM_NOTE,
    team: Team.CHAOTIC,
    displayName: 'Nota de Rescate',
    description: 'Silencia a un jugador',
    playerGuide:
      'Silencias a un jugador por la noche para que no pueda actuar ni votar al día siguiente. Además, el sistema publicará un mensaje tuyo de forma anónima.',
    priority: 11,
  },
  [RoleName.DROPPER]: {
    id: RoleName.DROPPER,
    team: Team.CHAOTIC,
    displayName: 'Dropper',
    description: 'Ignora protecciones',
    playerGuide:
      'Eliges a un jugador. En la noche siguiente, nadie podrá protegerlo, curarlo ni revivirlo si es atacado. Tú empiezas con un escudo de protección, y ganas otro escudo extra (hasta 2) cada vez que usas tu habilidad.',
    priority: 18,
  },
  [RoleName.SABOTEUR]: {
    id: RoleName.SABOTEUR,
    team: Team.CHAOTIC,
    displayName: 'Saboteador',
    description: 'Supervivencia máxima',
    playerGuide:
      'Te escondes durante la noche: las investigaciones te verán como SEGURO, los hackers no pueden votarte y sobrevivirás a una expulsión diurna aunque todos voten contra ti.',
    priority: 13,
  },
  [RoleName.WHITE_NOISE]: {
    id: RoleName.WHITE_NOISE,
    team: Team.CHAOTIC,
    displayName: 'Ruido Blanco',
    description: 'Mensajes falsos',
    playerGuide:
      'Durante la noche, dejas un mensaje anónimo en el foro público para confundir al resto de jugadores.',
    priority: 6,
  },
  [RoleName.MIRAGE]: {
    id: RoleName.MIRAGE,
    team: Team.CHAOTIC,
    displayName: 'Espejismo',
    description: 'Engaño visual',
    playerGuide:
      'Te ocultas a ti mismo por la noche. Si alguien te investiga, aparecerás como SEGURO en sus reportes.',
    priority: 15,
  },
  [RoleName.CHAOS_ROUTER]: {
    id: RoleName.CHAOS_ROUTER,
    team: Team.CHAOTIC,
    displayName: 'Router del Caos',
    description: 'Desvía ataques',
    playerGuide:
      'Eliges a dos personas: el jugador Origen y el jugador Destino. Si alguien ataca al Origen por la noche, el ataque se desviará mágicamente hacia el Destino.',
    priority: 17,
  },
};

export type RoleId = RoleName;
