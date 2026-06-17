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
  // priority can be used by RuleEngine to resolve concurrent effects
  priority?: number;
}

export const ROLE_CATALOG: Record<RoleName, Role> = {
  // System
  [RoleName.SYSADMIN]: { id: RoleName.SYSADMIN, team: Team.SYSTEM, displayName: 'SysAdmin', description: 'Administrador del sistema', priority: 50 },
  [RoleName.SOC_ANALYST]: { id: RoleName.SOC_ANALYST, team: Team.SYSTEM, displayName: 'Analista SOC', description: 'Monitorea actividad sospechosa', priority: 40 },
  [RoleName.ANTIVIRUS]: { id: RoleName.ANTIVIRUS, team: Team.SYSTEM, displayName: 'Antivirus', description: 'Protege/curar a un jugador durante la noche', priority: 60 },
  [RoleName.PENTESTER]: { id: RoleName.PENTESTER, team: Team.SYSTEM, displayName: 'Pentester', description: 'Investiga a un objetivo', priority: 30 },
  [RoleName.HONEYPOT]: { id: RoleName.HONEYPOT, team: Team.SYSTEM, displayName: 'Honeypot', description: 'Atrae ataques', priority: 20 },
  [RoleName.DEEP_FREEZE]: { id: RoleName.DEEP_FREEZE, team: Team.SYSTEM, displayName: 'Deep Freeze', description: 'Congela acciones sobre un objetivo', priority: 70 },
  [RoleName.BGP_ROUTER]: { id: RoleName.BGP_ROUTER, team: Team.SYSTEM, displayName: 'Enrutador BGP', description: 'Redirige tráfico/ataques', priority: 35 },

  // Black Hat
  [RoleName.DDOS]: { id: RoleName.DDOS, team: Team.BLACK_HAT, displayName: 'DDoS Operator', description: 'Ataca a un objetivo con denegación de servicio', priority: 25 },
  [RoleName.ROOTKIT]: { id: RoleName.ROOTKIT, team: Team.BLACK_HAT, displayName: 'Rootkit', description: 'Compromete de forma persistente', priority: 45 },
  [RoleName.RANSOMWARE]: { id: RoleName.RANSOMWARE, team: Team.BLACK_HAT, displayName: 'Ransomware', description: 'Secuestra recursos de un objetivo', priority: 55 },
  [RoleName.SPYWARE]: { id: RoleName.SPYWARE, team: Team.BLACK_HAT, displayName: 'Spyware', description: 'Espía acciones/roles', priority: 15 },
  [RoleName.PHISHER]: { id: RoleName.PHISHER, team: Team.BLACK_HAT, displayName: 'Phisher', description: 'Engaña a un objetivo para revelar información', priority: 10 },

  // Chaotic
  [RoleName.TROLL]: { id: RoleName.TROLL, team: Team.CHAOTIC, displayName: 'Troll', description: 'Causa efectos aleatorios', priority: 5 },
  [RoleName.WORM]: { id: RoleName.WORM, team: Team.CHAOTIC, displayName: 'Gusano', description: 'Se propaga y causa colisiones', priority: 28 },
  [RoleName.CRYPTO_MINER]: { id: RoleName.CRYPTO_MINER, team: Team.CHAOTIC, displayName: 'Minero de Cripto', description: 'Consume recursos del objetivo', priority: 12 },
  [RoleName.ZERO_DAY]: { id: RoleName.ZERO_DAY, team: Team.CHAOTIC, displayName: 'Zero-Day', description: 'Efectos impredecibles y potentes', priority: 65 },
};

export type RoleId = RoleName;
