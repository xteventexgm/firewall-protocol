import { PlayerRoleMeta } from './models/game-state.model';

/** Mapeo rol → acción nocturna por defecto (contrato backend). */
export const ROLE_NIGHT_ACTION: Record<string, string> = {
  'Analista SOC': 'scan',
  Antivirus: 'protect',
  Pentester: 'pentester_kill',
  'Deep Freeze': 'freeze',
  'Enrutador BGP': 'bgp_swap',
  Honeypot: 'honeypot_drag',
  'Detector IDS': 'ids_watch',
  Parcheador: 'patch_harden',
  'Analista Forense': 'forensic_trace',
  'Nodo de Respaldo': 'backup_mark',
  'Cazador de Amenazas': 'threat_hunt',
  'Respondedor de Incidentes': 'incident_clear',
  'Cortafuegos WAF': 'waf_block',
  'Intel de Amenazas': 'intel_pulse',
  'Monitor de Integridad': 'ally_verify',
  'DDoS Operator': 'hacker_vote',
  Rootkit: 'hacker_vote',
  Ransomware: 'ransomware',
  Spyware: 'spy',
  Phisher: 'phisher_redirect',
  'Fuerza Bruta': 'brute_force',
  Sniffer: 'team_probe',
  'Kit de Exploits': 'exploit_strip',
  'Implante Backdoor': 'backdoor_plant',
  'Movimiento Lateral': 'lateral_probe',
  Keylogger: 'vote_trace',
  'Escáner de Vulnerabilidades': 'vuln_scan',
  'Robador de Credenciales': 'cred_probe',
  'Proxy MitM': 'mitm_hijack',
  Gusano: 'worm_infect',
  'Zero-Day': 'zero_day_assume',
  Troll: 'troll_provoke',
  'Minero de Cripto': 'mine_crypto',
  Filtrador: 'data_leak',
  Sombra: 'shadow_mask',
  'Bomba Lógica': 'logic_bomb',
  'Envenenador DNS': 'dns_spoof',
  'Nota de Rescate': 'ransom_note',
  Dropper: 'rigged_payload',
  Saboteador: 'jam_hacker',
  'Ruido Blanco': 'noise_burst',
  Espejismo: 'mirage_cloak',
  'Router del Caos': 'chaos_route',
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

/** Hackers con habilidad propia también votan en el consenso nocturno. */
const BLACK_HAT_ABILITY_ROLES = new Set([
  'Ransomware',
  'Spyware',
  'Phisher',
  'Fuerza Bruta',
  'Sniffer',
  'Kit de Exploits',
  'Implante Backdoor',
  'Movimiento Lateral',
  'Keylogger',
  'Escáner de Vulnerabilidades',
  'Robador de Credenciales',
  'Proxy MitM',
  'Gusano',
  'Zero-Day',
  'Filtrador',
  'Sombra',
  'Bomba Lógica',
  'Envenenador DNS',
  'Nota de Rescate',
  'Dropper',
  'Saboteador',
  'Espejismo',
  'Router del Caos',
]);

export function getNightActionVariants(role: string | undefined): { value: string; label: string }[] {
  if (!role) return [];
  if (ROLE_NIGHT_VARIANTS[role]?.length) return ROLE_NIGHT_VARIANTS[role];
  if (!BLACK_HAT_ABILITY_ROLES.has(role)) return [];
  const primary = ROLE_NIGHT_ACTION[role];
  if (!primary || primary === 'hacker_vote') return [];
  return [
    { value: primary, label: getNightActionLabel(role, primary) },
    { value: 'hacker_vote', label: 'Votar eliminación (consenso hacker)' },
  ];
}

export function getNightActionType(role: string | undefined, variant?: string): string | null {
  if (!role) return null;
  if (variant) return variant;
  return ROLE_NIGHT_ACTION[role] ?? null;
}

export function needsSecondaryTarget(role: string | undefined, actionType?: string): boolean {
  if (actionType) {
    return actionType === 'bgp_swap' || actionType === 'phisher_redirect' || actionType === 'mitm_hijack' || actionType === 'chaos_route';
  }
  return role === 'Enrutador BGP' || role === 'Phisher' || role === 'Proxy MitM' || role === 'Router del Caos';
}

export function isTrollProvoke(role: string | undefined, actionType?: string): boolean {
  return role === 'Troll' || actionType === 'troll_provoke';
}

export function isNoiseBurst(role: string | undefined, actionType?: string): boolean {
  return role === 'Ruido Blanco' || actionType === 'noise_burst';
}

export function isMirageCloak(role: string | undefined, actionType?: string): boolean {
  return role === 'Espejismo' || actionType === 'mirage_cloak';
}

export function isJamSignal(role: string | undefined, actionType?: string): boolean {
  return role === 'Saboteador' || actionType === 'jam_hacker';
}

export function isIntelPulse(role: string | undefined, actionType?: string): boolean {
  return role === 'Intel de Amenazas' || actionType === 'intel_pulse';
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

export const WHITE_NOISE_MESSAGES = [
  'Checksum de integridad corrupto en un nodo no identificado.',
  'Tráfico ICMP anómalo detectado en el segmento interno.',
  'Dos nodos reportan la misma dirección MAC.',
  'Latencia espuria en el canal de votación diurna.',
  'Paquete duplicado en cola de consenso — origen desconocido.',
  'Sensor perimetral en modo parpadeo. Falsa alarma o intrusión.',
];

export function getSecondaryTargetLabel(role: string | undefined, actionType?: string): string {
  if (actionType) {
    if (actionType === 'bgp_swap') return 'Nodo destino (intercambio)';
    if (actionType === 'chaos_route') return 'Nodo colateral (desvío de ataques)';
    if (actionType === 'phisher_redirect') return 'Redirigir voto diurno hacia';
    if (actionType === 'mitm_hijack') return 'Forzar voto hacker hacia';
  }
  if (role === 'Enrutador BGP') return 'Nodo destino (intercambio)';
  if (role === 'Router del Caos') return 'Nodo colateral (desvío de ataques)';
  if (role === 'Phisher') return 'Redirigir voto diurno hacia';
  if (role === 'Proxy MitM') return 'Forzar voto hacker hacia';
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
  if (meta.bruteForceUsesLeft != null) {
    lines.push(`Fuerza bruta restante: ${meta.bruteForceUsesLeft}/1`);
  }
  if (meta.backupMarkUsesLeft != null) {
    lines.push(`Respaldo disponible: ${meta.backupMarkUsesLeft}/1`);
  }
  if (meta.intelPulseUsed) {
    lines.push('Pulso de intel ya utilizado');
  }
  if (meta.shieldCharges != null) {
    const start = minerStartingShields(playerCount);
    lines.push(
      `Escudos cripto: ${meta.shieldCharges}/${MINER_ACCUM_MAX} (inicio mesa: ${start}; no bloquean infección madura)`,
    );
  }
  if (meta.chaosShieldCharges != null && role === 'Dropper') {
    lines.push(`Escudo caótico: ${meta.chaosShieldCharges}/2 (bloquea kills directos; no infección madura)`);
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

const ACTION_LABELS: Record<string, string> = {
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
  ids_watch: 'Vigilar nodo (IDS)',
  patch_harden: 'Endurecer nodo',
  forensic_trace: 'Rastrear incidentes',
  brute_force: 'Ataque de fuerza bruta',
  team_probe: 'Sondear bando',
  exploit_strip: 'Anular EDR del objetivo',
  data_leak: 'Filtrar bando al feed',
  shadow_mask: 'Enmascarar en escaneos SOC',
  logic_bomb: 'Armar bomba lógica',
  backup_mark: 'Marcar respaldo',
  threat_hunt: 'Cazar amenaza',
  incident_clear: 'Levantar restricciones',
  waf_block: 'Bloquear Gusano',
  intel_pulse: 'Pulso de intel',
  ally_verify: 'Verificar aliado',
  backdoor_plant: 'Implantar backdoor',
  lateral_probe: 'Reconocimiento lateral',
  vote_trace: 'Rastrear voto',
  vuln_scan: 'Escanear vulnerabilidades',
  cred_probe: 'Robar credenciales',
  mitm_hijack: 'Secuestrar voto hacker',
  dns_spoof: 'Envenenar DNS',
  rigged_payload: 'Carga manipulada',
  jam_hacker: 'Jam de señal (sobre ti)',
  chaos_route: 'Desviar tráfico',
  ransom_note: 'Nota de rescate',
  noise_burst: 'Ruido en el feed',
  mirage_cloak: 'Activar espejismo',
};

export function getNightActionLabel(role: string | undefined, actionType?: string): string {
  if (actionType && ACTION_LABELS[actionType]) {
    return ACTION_LABELS[actionType];
  }

  const type = getNightActionType(role, actionType);
  if (type && ACTION_LABELS[type]) {
    return ACTION_LABELS[type];
  }

  return role ? 'Seleccionar objetivo' : 'Seleccionar objetivo';
}
