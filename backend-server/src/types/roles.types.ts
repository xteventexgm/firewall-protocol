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
  // priority can be used by RuleEngine to resolve concurrent effects
  priority?: number;
}

export const ROLE_CATALOG: Record<RoleName, Role> = {
  // System
  [RoleName.SYSADMIN]: {
    id: RoleName.SYSADMIN,
    team: Team.SYSTEM,
    displayName: 'SysAdmin',
    description: 'Administrador del sistema',
    playerGuide: 'Líder defensivo del Sistema. Sin acción nocturna: coordina al equipo de día y en las votaciones. Victoria del Sistema al eliminar a todos los hackers.',
    priority: 50,
  },
  [RoleName.SOC_ANALYST]: {
    id: RoleName.SOC_ANALYST,
    team: Team.SYSTEM,
    displayName: 'Analista SOC',
    description: 'Monitorea actividad sospechosa',
    playerGuide: 'Analista de seguridad. De noche escaneas un jugador y el servidor te indica si es SEGURO o MALICIOSO. El Rootkit siempre aparece como seguro.',
    priority: 40,
  },
  [RoleName.ANTIVIRUS]: {
    id: RoleName.ANTIVIRUS,
    team: Team.SYSTEM,
    displayName: 'Antivirus',
    description: 'Protege/curar a un jugador durante la noche',
    playerGuide: 'Escudo del Sistema. Protege a un jugador cada noche para bloquear un intento de eliminación. No puedes proteger al mismo objetivo dos noches seguidas.',
    priority: 60,
  },
  [RoleName.PENTESTER]: {
    id: RoleName.PENTESTER,
    team: Team.SYSTEM,
    displayName: 'Pentester',
    description: 'Investiga a un objetivo',
    playerGuide: 'Cazador ofensivo del Sistema. Puedes eliminar a un jugador de noche (2 usos). Si eliminas a un aliado del Sistema, tú también caes.',
    priority: 30,
  },
  [RoleName.HONEYPOT]: {
    id: RoleName.HONEYPOT,
    team: Team.SYSTEM,
    displayName: 'Honeypot',
    description: 'Atrae ataques',
    playerGuide: 'Trampa del Sistema. Cada noche marcas a un jugador. Si te eliminan, arrastras contigo a quien hayas marcado.',
    priority: 20,
  },
  [RoleName.DEEP_FREEZE]: {
    id: RoleName.DEEP_FREEZE,
    team: Team.SYSTEM,
    displayName: 'Deep Freeze',
    description: 'Congela acciones sobre un objetivo',
    playerGuide: 'Control de incidentes. Congelas a un jugador para anular sus acciones nocturnas de esa ronda.',
    priority: 70,
  },
  [RoleName.BGP_ROUTER]: {
    id: RoleName.BGP_ROUTER,
    team: Team.SYSTEM,
    displayName: 'Enrutador BGP',
    description: 'Redirige tráfico/ataques',
    playerGuide: 'Red del Sistema. Intercambias el destino de dos jugadores para redirigir ataques nocturnos entre ellos.',
    priority: 35,
  },

  // Black Hat
  [RoleName.DDOS]: {
    id: RoleName.DDOS,
    team: Team.BLACK_HAT,
    displayName: 'DDoS Operator',
    description: 'Ataca a un objetivo con denegación de servicio',
    playerGuide: 'Atacante del equipo Hacker. De noche votas con tus compañeros a quién eliminar; hace falta mayoría simple. Conoces a los demás hackers.',
    priority: 25,
  },
  [RoleName.ROOTKIT]: {
    id: RoleName.ROOTKIT,
    team: Team.BLACK_HAT,
    displayName: 'Rootkit',
    description: 'Compromete de forma persistente',
    playerGuide: 'Hacker sigiloso. Votas con el equipo para eliminar objetivos y eres invisible a los escaneos del Analista SOC. Conoces a los demás hackers.',
    priority: 45,
  },
  [RoleName.RANSOMWARE]: {
    id: RoleName.RANSOMWARE,
    team: Team.BLACK_HAT,
    displayName: 'Ransomware',
    description: 'Secuestra recursos de un objetivo',
    playerGuide: 'Hacker de presión. Silencias a un jugador hasta el día siguiente para que no actúe ni vote. Conoces a los demás hackers.',
    priority: 55,
  },
  [RoleName.SPYWARE]: {
    id: RoleName.SPYWARE,
    team: Team.BLACK_HAT,
    displayName: 'Spyware',
    description: 'Espía acciones/roles',
    playerGuide: 'Hacker espía. Observas quién visita a tu objetivo cada noche. Conoces a los demás hackers.',
    priority: 15,
  },
  [RoleName.PHISHER]: {
    id: RoleName.PHISHER,
    team: Team.BLACK_HAT,
    displayName: 'Phisher',
    description: 'Engaña a un objetivo para revelar información',
    playerGuide: 'Hacker de engaño. Rediriges las acciones nocturnas de un jugador hacia otro objetivo. Conoces a los demás hackers.',
    priority: 10,
  },

  // Chaotic
  [RoleName.TROLL]: {
    id: RoleName.TROLL,
    team: Team.CHAOTIC,
    displayName: 'Troll',
    description: 'Causa efectos aleatorios',
    playerGuide: 'Agente caótico sin acción nocturna. Ganas en solitario si el grupo te expulsa por votación.',
    priority: 5,
  },
  [RoleName.WORM]: {
    id: RoleName.WORM,
    team: Team.CHAOTIC,
    displayName: 'Gusano',
    description: 'Se propaga y causa colisiones',
    playerGuide: 'Amenaza autónoma. Eres inmune al primer ataque, puedes eliminar jugadores de noche y ganas en solitario si quedas como último en pie.',
    priority: 28,
  },
  [RoleName.CRYPTO_MINER]: {
    id: RoleName.CRYPTO_MINER,
    team: Team.CHAOTIC,
    displayName: 'Minero de Cripto',
    description: 'Consume recursos del objetivo',
    playerGuide: 'Superviviente caótico. Sin acción nocturna, pero empiezas con 3 escudos que bloquean ataques. Victoria en solitario si cumples tu condición de supervivencia.',
    priority: 12,
  },
  [RoleName.ZERO_DAY]: {
    id: RoleName.ZERO_DAY,
    team: Team.CHAOTIC,
    displayName: 'Zero-Day',
    description: 'Efectos impredecibles y potentes',
    playerGuide: 'Exploit impredecible. De noche puedes asumir el rol de un jugador ya eliminado para heredar sus habilidades.',
    priority: 65,
  },
};

export type RoleId = RoleName;
