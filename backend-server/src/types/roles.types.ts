/**
 * Catálogo de roles, equipos y textos orientados al jugador (`playerGuide`).
 *
 * 16 roles en tres bandos: System (7), Black Hat (5), Caótico (4).
 * `ROLE_CATALOG` alimenta Matchmaking, roleInfo (móvil) y RuleEngine (scan).
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

  // Black Hat (Red Team)
  DDOS = 'DDoS Operator',
  ROOTKIT = 'Rootkit',
  RANSOMWARE = 'Ransomware',
  SPYWARE = 'Spyware',
  PHISHER = 'Phisher',

  // Chaotic
  TROLL = 'Troll',
  WORM = 'Gusano',
  CRYPTO_MINER = 'Minero de Cripto',
  ZERO_DAY = 'Zero-Day',
}

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
      'Administrador de infraestructura. Sin acción nocturna: coordina parches, credenciales y votaciones. Victoria del Sistema al eliminar a todos los hackers.',
    priority: 50,
  },
  [RoleName.SOC_ANALYST]: {
    id: RoleName.SOC_ANALYST,
    team: Team.SYSTEM,
    displayName: 'Analista SOC',
    description: 'Monitorea actividad sospechosa',
    playerGuide:
      'Analista SIEM. De noche correlacionas un nodo: SEGURO (Sistema), SOSPECHOSO (anómalo / caótico) o MALICIOSO (amenaza hacker). El Rootkit siempre aparece como SEGURO. No revela el rol exacto.',
    priority: 40,
  },
  [RoleName.ANTIVIRUS]: {
    id: RoleName.ANTIVIRUS,
    team: Team.SYSTEM,
    displayName: 'Antivirus',
    description: 'Protege/curar a un jugador durante la noche',
    playerGuide:
      'EDR del Sistema. Una acción por noche: protect (bloquea un kill sobre el objetivo) o cure (remedia infección). No repitas el mismo nodo dos noches seguidas con la misma acción.',
    priority: 60,
  },
  [RoleName.PENTESTER]: {
    id: RoleName.PENTESTER,
    team: Team.SYSTEM,
    displayName: 'Pentester',
    description: 'Investiga a un objetivo',
    playerGuide:
      'Red team autorizado. Eliminas a un jugador de noche (1 uso en mesas pequeñas, 2 en 8+). Si eliminas a un aliado del Sistema, el incidente te cuesta el puesto.',
    priority: 30,
  },
  [RoleName.HONEYPOT]: {
    id: RoleName.HONEYPOT,
    team: Team.SYSTEM,
    displayName: 'Honeypot',
    description: 'Atrae ataques',
    playerGuide:
      'Señuelo defensivo. Cada noche marcas un nodo. Si caes en un ataque nocturno, arrastras contigo a quien marcaste (la trampa ignora protección Antivirus).',
    priority: 20,
  },
  [RoleName.DEEP_FREEZE]: {
    id: RoleName.DEEP_FREEZE,
    team: Team.SYSTEM,
    displayName: 'Deep Freeze',
    description: 'Congela acciones sobre un objetivo',
    playerGuide:
      'Contención EDR. Aislas un endpoint: sus acciones nocturnas de esta ronda no surten efecto.',
    priority: 70,
  },
  [RoleName.BGP_ROUTER]: {
    id: RoleName.BGP_ROUTER,
    team: Team.SYSTEM,
    displayName: 'Enrutador BGP',
    description: 'Redirige tráfico/ataques',
    playerGuide:
      'Mitigación de enrutamiento. Intercambias el destino de dos nodos para desviar ataques nocturnos dirigidos a ellos.',
    priority: 35,
  },

  [RoleName.DDOS]: {
    id: RoleName.DDOS,
    team: Team.BLACK_HAT,
    displayName: 'DDoS Operator',
    description: 'Ataca a un objetivo con denegación de servicio',
    playerGuide:
      'Operador de botnet. Tu voto en el consenso hacker cuenta doble. Si hay consenso, el objetivo queda degradado (silenciado al día siguiente) aunque sobreviva el ataque. Conoces a los demás hackers.',
    priority: 25,
  },
  [RoleName.ROOTKIT]: {
    id: RoleName.ROOTKIT,
    team: Team.BLACK_HAT,
    displayName: 'Rootkit',
    description: 'Compromete de forma persistente',
    playerGuide:
      'Implant persistente. Votas con el equipo para eliminar objetivos; los escaneos SOC te clasifican como SEGURO. Conoces a los demás hackers.',
    priority: 45,
  },
  [RoleName.RANSOMWARE]: {
    id: RoleName.RANSOMWARE,
    team: Team.BLACK_HAT,
    displayName: 'Ransomware',
    description: 'Secuestra recursos de un objetivo',
    playerGuide:
      'Cifrado operativo. Silencias a un jugador hasta el día siguiente (no actúa ni vota). Enfriamiento tras cada uso según tamaño de sala. Conoces a los demás hackers.',
    priority: 55,
  },
  [RoleName.SPYWARE]: {
    id: RoleName.SPYWARE,
    team: Team.BLACK_HAT,
    displayName: 'Spyware',
    description: 'Espía acciones/roles',
    playerGuide:
      'Interceptas tráfico hacia un objetivo: ves qué nodos lo visitaron y el tipo de actividad (sin revelar roles). Conoces a los demás hackers.',
    priority: 15,
  },
  [RoleName.PHISHER]: {
    id: RoleName.PHISHER,
    team: Team.BLACK_HAT,
    displayName: 'Phisher',
    description: 'Engaña a un objetivo para revelar información',
    playerGuide:
      'Ingeniería social. Rediriges el voto diurno de un jugador hacia otro objetivo (fase VOTACION). Conoces a los demás hackers.',
    priority: 10,
  },

  [RoleName.TROLL]: {
    id: RoleName.TROLL,
    team: Team.CHAOTIC,
    displayName: 'Troll',
    description: 'Causa efectos aleatorios',
    playerGuide:
      'Actor de desinformación. Sin acción nocturna. Victoria en solitario si el grupo te expulsa por votación.',
    priority: 5,
  },
  [RoleName.WORM]: {
    id: RoleName.WORM,
    team: Team.CHAOTIC,
    displayName: 'Gusano',
    description: 'Se propaga y causa colisiones',
    playerGuide:
      'Malware autónomo. Infectas de noche; el nodo cae tras dos noches sin cura. Tu primera eliminación nocturna falla (persistencia); después eres vulnerable. Victoria en solitario si quedas como último en pie.',
    priority: 28,
  },
  [RoleName.CRYPTO_MINER]: {
    id: RoleName.CRYPTO_MINER,
    team: Team.CHAOTIC,
    displayName: 'Minero de Cripto',
    description: 'Consume recursos del objetivo',
    playerGuide:
      'Cryptojacking pasivo. Sin acción nocturna. Resistes eliminaciones directas (2 capas en mesas pequeñas, 3 en 8+); las infecciones maduras sí pueden eliminarte. Ganas si eres el único jugador vivo.',
    priority: 12,
  },
  [RoleName.ZERO_DAY]: {
    id: RoleName.ZERO_DAY,
    team: Team.CHAOTIC,
    displayName: 'Zero-Day',
    description: 'Efectos impredecibles y potentes',
    playerGuide:
      'Exploit 0-day (una vez por partida). Asumes el rol de un jugador ya eliminado y heredas sus habilidades; los escaneos SOC reflejan tu rol asumido.',
    priority: 65,
  },
};

export type RoleId = RoleName;
