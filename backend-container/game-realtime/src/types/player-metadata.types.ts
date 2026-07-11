/**
 * Metadata por jugador y mapa acción-nocturna ↔ rol.
 *
 * `PlayerMetadata` se guarda en `player.metadata` (JSON persistido).
 * `ROLE_NIGHT_ACTIONS` define qué `type` acepta ActionValidator por rol.
 */
import { PlayerId } from './events.types';
import { ROLE_CATALOG, RoleName, Team } from './roles.types';

/** Estado de infección (Gusano u otra fuente) sobre un nodo. */
export interface PlayerInfection {
  sourcePlayerId: PlayerId;
  /** Origen de la infección: worm, etc. */
  source: string;
  appliedOnNight: number;
  maturesAfterNight: number;
}

/**
 * Flags runtime por jugador. Inicializados en `initRoleMetadata` (`playerMetadata.ts`).
 * Algunos campos se ocultan a otros clientes vía `GameStateModel.sanitizeMetadata`.
 */
export interface PlayerMetadata {
  actedThisNight?: boolean;
  hasSentLastWill?: boolean;
  /** Voto de consenso hacker enviado esta noche (independiente de la habilidad del rol). */
  hackerVoteTonight?: boolean;
  lastProtectedTarget?: PlayerId | null;
  lastCuredTarget?: PlayerId | null;
  pentesterUsesLeft?: number;
  bruteForceUsesLeft?: number;
  shieldCharges?: number;
  ransomwareCooldown?: number;
  silencedUntilDay?: number;
  honeypotDragTarget?: PlayerId | null;
  phisherRedirects?: Record<PlayerId, PlayerId>;
  assumedFromPlayerId?: PlayerId | null;
  isWormImmune?: boolean;
  infection?: PlayerInfection;
  /** SysAdmin: parche de emergencia (anula voto de un jugador, 1×/partida). */
  emergencyPatchUsed?: boolean;
  /** SysAdmin: objetivo cuyo voto fue anulado este día. */
  patchedVoterId?: PlayerId | null;
  /** Troll: mensajes provoke usados por noche. */
  trollProvokeUsedTonight?: boolean;
  /** Minero: último nodo minado (cooldown una noche). */
  lastMinedTarget?: PlayerId | null;
  /** Parcheador: noche hasta la que el nodo ignora consenso hacker. */
  consensusBlockedUntilNight?: number;
  /** Kit de Exploits: noche en que el protect EDR no aplica sobre el nodo. */
  exploitStrippedUntilNight?: number;
  /** Sombra: noche hasta la que el nodo aparece SEGURO en scan SOC. */
  scanMaskedUntilNight?: number;
  /** Bomba lógica: detona si el nodo actúa mientras está armada. */
  logicBombArmed?: boolean;
  /** IDS: objetivo vigilado esta noche (runtime). */
  idsWatchTarget?: PlayerId | null;
  /** Nodo de Respaldo: absorbe un kill esta noche. */
  backupSaveTonight?: boolean;
  /** Nodo de Respaldo: usos restantes (actor). */
  backupMarkUsesLeft?: number;
  /** Intel de Amenazas: pulso usado. */
  intelPulseUsed?: boolean;
  /** Implante Backdoor: +1 voto consenso contra este nodo esta noche. */
  backdoorBonusTonight?: boolean;
  /** Cortafuegos WAF: bloquea worm esta noche. */
  wormBlockedUntilNight?: number;
  /** Saboteador: no puede votar hasta este día inclusive. */
  voteBlockedUntilDay?: number;
  /** Envenenador DNS: voto del objetivo se desvía al azar este día. */
  dnsVoteSpoofUntilDay?: number;
  /** Dropper: ignora protecciones esta noche. */
  riggedPayloadUntilNight?: number;
  /** Dropper: escudo caótico (bloquea kills directos). */
  chaosShieldCharges?: number;
  /** Saboteador: escudo de linchamiento hasta este día inclusive. */
  lynchSurvivorUntilDay?: number;
  lynchSurvivorConsumed?: boolean;
}

/** Tipos de acción nocturna permitidos por rol (validados en ActionValidator). */
export const ROLE_NIGHT_ACTIONS: Partial<Record<RoleName, string[]>> = {
  [RoleName.SOC_ANALYST]: ['scan'],
  [RoleName.ANTIVIRUS]: ['protect', 'cure'],
  [RoleName.PENTESTER]: ['pentester_kill'],
  [RoleName.DEEP_FREEZE]: ['freeze'],
  [RoleName.BGP_ROUTER]: ['bgp_swap'],
  [RoleName.DDOS]: ['hacker_vote'],
  [RoleName.ROOTKIT]: ['hacker_vote'],
  [RoleName.RANSOMWARE]: ['ransomware'],
  [RoleName.SPYWARE]: ['spy'],
  [RoleName.PHISHER]: ['phisher_redirect'],
  [RoleName.WORM]: ['worm_infect', 'worm_kill'],
  [RoleName.ZERO_DAY]: ['zero_day_assume'],
  [RoleName.HONEYPOT]: ['honeypot_drag'],
  [RoleName.TROLL]: ['troll_provoke'],
  [RoleName.CRYPTO_MINER]: ['mine_crypto', 'crypto_bribe'],
  [RoleName.IDS]: ['ids_watch'],
  [RoleName.PATCH_MANAGER]: ['patch_harden'],
  [RoleName.FORENSIC_ANALYST]: ['forensic_trace'],
  [RoleName.BRUTE_FORCE]: ['brute_force'],
  [RoleName.SNIFFER]: ['team_probe'],
  [RoleName.EXPLOIT_KIT]: ['exploit_strip'],
  [RoleName.DATA_LEAKER]: ['data_leak'],
  [RoleName.SHADOW]: ['shadow_mask'],
  [RoleName.LOGIC_BOMB]: ['logic_bomb'],
  [RoleName.BACKUP_NODE]: ['backup_mark'],
  [RoleName.THREAT_HUNTER]: ['threat_hunt'],
  [RoleName.INCIDENT_RESPONDER]: ['incident_clear'],
  [RoleName.WAF]: ['waf_block'],
  [RoleName.THREAT_INTEL]: ['intel_pulse'],
  [RoleName.INTEGRITY_MONITOR]: ['ally_verify'],
  [RoleName.BACKDOOR_IMPLANT]: ['backdoor_plant'],
  [RoleName.LATERAL_MOVE]: ['lateral_probe'],
  [RoleName.KEYLOGGER]: ['vote_trace'],
  [RoleName.VULN_SCANNER]: ['vuln_scan'],
  [RoleName.CREDENTIAL_STEALER]: ['cred_probe'],
  [RoleName.MITM_PROXY]: ['mitm_hijack'],
  [RoleName.DNS_POISONER]: ['dns_spoof'],
  [RoleName.RANSOM_NOTE]: ['ransom_note'],
  [RoleName.DROPPER]: ['rigged_payload'],
  [RoleName.SABOTEUR]: ['jam_hacker'],
  [RoleName.WHITE_NOISE]: ['noise_burst'],
  [RoleName.MIRAGE]: ['mirage_cloak'],
  [RoleName.CHAOS_ROUTER]: ['chaos_route'],
};

/** Hackers con habilidad especial también participan en el consenso nocturno. */
const HACKER_VOTE_ONLY = new Set<RoleName>([RoleName.DDOS, RoleName.ROOTKIT]);
for (const role of Object.values(RoleName)) {
  const catalog = ROLE_CATALOG[role];
  if (catalog?.team !== Team.BLACK_HAT) continue;
  const actions = ROLE_NIGHT_ACTIONS[role];
  if (!actions || HACKER_VOTE_ONLY.has(role) || actions.includes('hacker_vote')) continue;
  actions.push('hacker_vote');
}
