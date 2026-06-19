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
};

/** Roles con más de una acción nocturna posible. */
export const ROLE_NIGHT_VARIANTS: Record<string, { value: string; label: string }[]> = {
  Antivirus: [
    { value: 'protect', label: 'Proteger (bloquear kill)' },
    { value: 'cure', label: 'Curar infección' },
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

export function getSecondaryTargetLabel(role: string | undefined): string {
  if (role === 'Enrutador BGP') return 'Nodo destino (intercambio)';
  if (role === 'Phisher') return 'Redirigir voto diurno hacia';
  return 'Segundo objetivo';
}

function pentesterMaxUses(playerCount: number): number {
  return playerCount <= 7 ? 1 : 2;
}

function minerMaxShields(playerCount: number): number {
  return playerCount <= 7 ? 2 : 3;
}

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
    lines.push(
      `Escudos cripto: ${meta.shieldCharges}/${minerMaxShields(playerCount)} (no bloquean infección madura)`,
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
  };
  return role ? (labels[role] ?? 'Seleccionar objetivo') : 'Seleccionar objetivo';
}
