import { PlayerRoleMeta } from './models/game-state.model';

/** Mapeo rol → acción nocturna por defecto (contrato backend). */
export const ROLE_NIGHT_ACTION: Record<string, string> = {
  'Analista SOC': 'scan',
  Antivirus: 'protect',
  Pentester: 'pentester_kill',
  'Deep Freeze': 'freeze',
  'Enrutador BGP': 'bgp_swap',
  Honeypot: 'honeypot_drag',
  'DDoS Operator': 'hacker_vote',
  Rootkit: 'hacker_vote',
  Ransomware: 'ransomware',
  Spyware: 'spy',
  Phisher: 'phisher_redirect',
  Gusano: 'worm_infect',
  'Zero-Day': 'zero_day_assume',
  Troll: 'troll_provoke',
  'Minero de Cripto': 'mine_crypto',
};

/** Roles con más de una acción nocturna posible. */
export const ROLE_NIGHT_VARIANTS: Record<string, { value: string; label: string }[]> = {
  Antivirus: [
    { value: 'protect', label: 'Proteger (bloquear kill)' },
    { value: 'cure', label: 'Curar infección' },
  ],
  'Minero de Cripto': [
    { value: 'mine_crypto', label: 'Minar (+1 escudo, máx. 3)' },
    { value: 'crypto_bribe', label: 'Soborno cripto (gasta 1 escudo → kill)' },
  ],
};

export function getNightActionVariants(role: string | undefined): { value: string; label: string }[] {
  if (!role) return [];
  return ROLE_NIGHT_VARIANTS[role] ?? [];
}

export function getNightActionType(role: string | undefined, variant?: string): string | null {
  if (!role) return null;
  if (variant) return variant;
  return ROLE_NIGHT_ACTION[role] ?? null;
}

export function needsSecondaryTarget(role: string | undefined): boolean {
  return role === 'Enrutador BGP' || role === 'Phisher';
}

export function isTrollProvoke(role: string | undefined, actionType?: string): boolean {
  return role === 'Troll' || actionType === 'troll_provoke';
}

export function canCryptoBribe(meta?: PlayerRoleMeta): boolean {
  return (meta?.shieldCharges ?? 0) >= 1;
}

export function isMinerRole(role: string | undefined): boolean {
  return role === 'Minero de Cripto';
}

export function canUseEmergencyPatch(role: string | undefined, meta?: { emergencyPatchUsed?: boolean }): boolean {
  return role === 'SysAdmin' && !meta?.emergencyPatchUsed;
}

export const TROLL_PROVOKE_MESSAGES = [
  'Alguien en esta red no es quien dice ser.',
  'Vi tráfico sospechoso hacia el firewall central.',
  'El Antivirus protegió al hacker equivocado anoche.',
  '¿Por qué nadie habla del nodo que cayó en silencio?',
  'Confía en mí: el último escaneo SOC mintió.',
  'Hay dos jugadores coordinando en secreto.',
  'Mañana caerá alguien inocente. Lo presiento.',
];

export function getSecondaryTargetLabel(role: string | undefined): string {
  if (role === 'Enrutador BGP') return 'Nodo destino (intercambio)';
  if (role === 'Phisher') return 'Redirigir voto diurno hacia';
  return 'Segundo objetivo';
}

function pentesterMaxUses(playerCount: number): number {
  return playerCount <= 7 ? 1 : 2;
}

function minerStartingShields(playerCount: number): number {
  return playerCount <= 7 ? 2 : 3;
}

const MINER_ACCUM_MAX = 3;

/** Líneas de estado dinámico según metadata del backend (solo jugador local). */
export function getRoleStatusLines(
  role: string | undefined,
  meta: PlayerRoleMeta | undefined,
  playerCount = 15,
): string[] {
  if (!meta) return [];
  const lines: string[] = [];
  if (meta.pentesterUsesLeft != null) {
    lines.push(`Eliminaciones restantes: ${meta.pentesterUsesLeft}/${pentesterMaxUses(playerCount)}`);
  }
  if (meta.shieldCharges != null) {
    const start = minerStartingShields(playerCount);
    lines.push(
      `Escudos cripto: ${meta.shieldCharges}/${MINER_ACCUM_MAX} (inicio mesa: ${start}; no bloquean infección madura)`,
    );
  }
  if (meta.ransomwareCooldown != null && meta.ransomwareCooldown > 0) {
    lines.push(`Secuestro en cooldown: ${meta.ransomwareCooldown} noche(s)`);
  }
  if (meta.isWormImmune && role === 'Gusano') {
    lines.push('Inmunidad al primer ataque — se consumirá al recibir un kill');
  }
  if (meta.assumedFromPlayerId) {
    lines.push('Identidad asumida — actúas con el rol del nodo caído');
  }
  if (meta.emergencyPatchUsed) {
    lines.push('Parche de emergencia ya utilizado');
  }
  return lines;
}

export function getNightActionLabel(role: string | undefined, actionType?: string): string {
  const byType: Record<string, string> = {
    scan: 'Escanear nodo',
    protect: 'Proteger nodo',
    cure: 'Curar infección',
    pentester_kill: 'Eliminar nodo',
    freeze: 'Congelar nodo',
    bgp_swap: 'Intercambiar tráfico',
    honeypot_drag: 'Marcar arrastre honeypot',
    hacker_vote: 'Votar eliminación',
    ransomware: 'Secuestrar nodo',
    spy: 'Espionar nodo',
    phisher_redirect: 'Redirigir voto diurno',
    worm_infect: 'Infectar nodo',
    worm_kill: 'Infectar nodo',
    zero_day_assume: 'Asumir identidad (muerto)',
    troll_provoke: 'Provocar (mensaje anónimo)',
    mine_crypto: 'Minar nodo (+1 escudo)',
    crypto_bribe: 'Soborno cripto (kill directo)',
  };

  if (actionType && byType[actionType]) {
    return byType[actionType];
  }

  const labels: Record<string, string> = {
    'Analista SOC': 'Escanear nodo',
    Antivirus: 'Proteger o curar',
    Pentester: 'Eliminar nodo',
    'Deep Freeze': 'Congelar nodo',
    'Enrutador BGP': 'Intercambiar tráfico',
    Honeypot: 'Arrastrar al honeypot',
    'DDoS Operator': 'Votar eliminación',
    Rootkit: 'Votar eliminación',
    Ransomware: 'Secuestrar nodo',
    Spyware: 'Espionar nodo',
    Phisher: 'Redirigir voto diurno',
    Gusano: 'Infectar nodo',
    'Zero-Day': 'Asumir identidad (muerto)',
    Troll: 'Provocar (mensaje anónimo)',
    'Minero de Cripto': 'Minar o sobornar',
  };
  return role ? (labels[role] ?? 'Seleccionar objetivo') : 'Seleccionar objetivo';
}
