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
      'Sin acción nocturna. Durante VOTACION puedes usar Parche de emergencia (1ÁEpartida): anulas por completo el voto de un jugador elegido. ' +
      SYSTEM_WIN,
    priority: 50,
  },
  [RoleName.SOC_ANALYST]: {
    id: RoleName.SOC_ANALYST,
    team: Team.SYSTEM,
    displayName: 'Analista SOC',
    description: 'Monitorea actividad sospechosa',
    playerGuide:
      'De noche (`scan`): correlacionas un nodo vivo. Resultado privado  E?? SEGURO (System), ? SOSPECHOSO (caótico) o ?? MALICIOSO (Black Hat). ' +
      'No revela el rol exacto. Rootkit y nodos enmascarados por Sombra aparecen como ?? SEGURO. ' +
      SYSTEM_WIN,
    priority: 40,
  },
  [RoleName.ANTIVIRUS]: {
    id: RoleName.ANTIVIRUS,
    team: Team.SYSTEM,
    displayName: 'Antivirus',
    description: 'Protege o cura durante la noche',
    playerGuide:
      'Una acción por noche: `protect` bloquea un kill directo o consenso hacker sobre el objetivo; `cure` elimina infección (Gusano). ' +
      'No repitas el mismo nodo dos noches seguidas con la misma acción. Kit de Exploits puede anular tu protect esa noche. ' +
      SYSTEM_WIN,
    priority: 60,
  },
  [RoleName.PENTESTER]: {
    id: RoleName.PENTESTER,
    team: Team.SYSTEM,
    displayName: 'Pentester',
    description: 'Eliminación autorizada de noche',
    playerGuide:
      '`pentester_kill`: intentas eliminar a un jugador vivo (1 uso en mesas ≤7 jugadores, 2 en 8+). ' +
      'Si matas a un aliado System, tu nodo también cae. Sujeto a protect, honeypot y escudos del Minero. ' +
      SYSTEM_WIN,
    priority: 30,
  },
  [RoleName.HONEYPOT]: {
    id: RoleName.HONEYPOT,
    team: Team.SYSTEM,
    displayName: 'Honeypot',
    description: 'Señuelo con arrastre',
    playerGuide:
      '`honeypot_drag`: marcas un nodo cada noche. Si **tú** mueres por un ataque nocturno, arrastras a quien marcaste (la trampa ignora protect del Antivirus). ' +
      SYSTEM_WIN,
    priority: 20,
  },
  [RoleName.DEEP_FREEZE]: {
    id: RoleName.DEEP_FREEZE,
    team: Team.SYSTEM,
    displayName: 'Deep Freeze',
    description: 'Congela acciones nocturnas',
    playerGuide:
      '`freeze`: aíslas un endpoint vivo; **todas** sus acciones nocturnas de esta ronda se anulan (incluido voto hacker). ' +
      SYSTEM_WIN,
    priority: 70,
  },
  [RoleName.BGP_ROUTER]: {
    id: RoleName.BGP_ROUTER,
    team: Team.SYSTEM,
    displayName: 'Enrutador BGP',
    description: 'Redirige destinos de ataques',
    playerGuide:
      '`bgp_swap`: intercambias el destino nocturno de dos nodos vivos; los ataques dirigidos a uno impactan al otro. ' +
      SYSTEM_WIN,
    priority: 35,
  },
  [RoleName.IDS]: {
    id: RoleName.IDS,
    team: Team.SYSTEM,
    displayName: 'Detector IDS',
    description: 'Vigila intrusiones sobre un nodo',
    playerGuide:
      '`ids_watch`: vigilas un nodo. Si recibe visitas hostiles esa noche (kill, infección, secuestro, etc.), recibes alerta privada con cuántas hubo (sin revelar roles). ' +
      SYSTEM_WIN,
    priority: 38,
  },
  [RoleName.PATCH_MANAGER]: {
    id: RoleName.PATCH_MANAGER,
    team: Team.SYSTEM,
    displayName: 'Parcheador',
    description: 'Endurece un nodo contra consenso hacker',
    playerGuide:
      '`patch_harden`: el objetivo no puede morir por **consenso hacker** esta noche (kills directos como Fuerza Bruta o Pentester sí aplican). ' +
      SYSTEM_WIN,
    priority: 42,
  },
  [RoleName.FORENSIC_ANALYST]: {
    id: RoleName.FORENSIC_ANALYST,
    team: Team.SYSTEM,
    displayName: 'Analista Forense',
    description: 'Rastrea incidentes recientes',
    playerGuide:
      '`forensic_trace`: eliges un nodo y recibes el desglose de bajas de la **última noche** por bando (System / Black Hat / Caótico) y si ese nodo estuvo entre las víctimas. ' +
      SYSTEM_WIN,
    priority: 33,
  },
  [RoleName.BACKUP_NODE]: {
    id: RoleName.BACKUP_NODE,
    team: Team.SYSTEM,
    displayName: 'Nodo de Respaldo',
    description: 'Salvaguarda única contra un kill',
    playerGuide:
      '`backup_mark` (1ÁEpartida): marcas un nodo vivo. Si moriría esta noche por un ataque, sobrevive una vez (se consume el respaldo). No bloquea infección madura. ' +
      SYSTEM_WIN,
    priority: 36,
  },
  [RoleName.THREAT_HUNTER]: {
    id: RoleName.THREAT_HUNTER,
    team: Team.SYSTEM,
    displayName: 'Cazador de Amenazas',
    description: 'Detección binaria de amenaza',
    playerGuide:
      '`threat_hunt`: sondeas un nodo  Eresultado privado AMENAZA (hacker o caótico) o LIMPIO (System / enmascarado). No revela el rol exacto. ' +
      SYSTEM_WIN,
    priority: 37,
  },
  [RoleName.INCIDENT_RESPONDER]: {
    id: RoleName.INCIDENT_RESPONDER,
    team: Team.SYSTEM,
    displayName: 'Respondedor de Incidentes',
    description: 'Levanta silencios operativos',
    playerGuide:
      '`incident_clear`: eliminas el silencio de Ransomware/DDoS sobre un jugador para que pueda actuar y votar al día siguiente. ' +
      SYSTEM_WIN,
    priority: 41,
  },
  [RoleName.WAF]: {
    id: RoleName.WAF,
    team: Team.SYSTEM,
    displayName: 'Cortafuegos WAF',
    description: 'Bloquea propagación de Gusano',
    playerGuide:
      '`waf_block`: el objetivo no puede ser infectado por `worm_infect` esta noche (kills directos y consenso hacker sí aplican). ' +
      SYSTEM_WIN,
    priority: 39,
  },
  [RoleName.THREAT_INTEL]: {
    id: RoleName.THREAT_INTEL,
    team: Team.SYSTEM,
    displayName: 'Intel de Amenazas',
    description: 'Panorama de bandos vivos',
    playerGuide:
      '`intel_pulse` (1ÁEpartida): recibes conteo privado de vivos por bando (hackers / system / caóticos). ' +
      SYSTEM_WIN,
    priority: 34,
  },
  [RoleName.INTEGRITY_MONITOR]: {
    id: RoleName.INTEGRITY_MONITOR,
    team: Team.SYSTEM,
    displayName: 'Monitor de Integridad',
    description: 'Verifica si un nodo es aliado',
    playerGuide:
      '`ally_verify`: compruebas si un nodo vivo pertenece a **tu mismo bando** (sí/no). Útil para detectar infiltrados sin revelar roles exactos. ' +
      SYSTEM_WIN,
    priority: 32,
  },

  [RoleName.DDOS]: {
    id: RoleName.DDOS,
    team: Team.BLACK_HAT,
    displayName: 'DDoS Operator',
    description: 'Voto hacker reforzado',
    playerGuide:
      '`hacker_vote`: votas el objetivo del consenso nocturno (mayoría simple entre hackers vivos). Tu voto cuenta **doble**. ' +
      'Si hay consenso y el objetivo sobrevive, queda degradado (silenciado al día siguiente). Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 25,
  },
  [RoleName.ROOTKIT]: {
    id: RoleName.ROOTKIT,
    team: Team.BLACK_HAT,
    displayName: 'Rootkit',
    description: 'Implant oculto al SOC',
    playerGuide:
      '`hacker_vote`: participas en el consenso nocturno para eliminar un objetivo. Los escaneos SOC te clasifican siempre como ?? SEGURO. Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 45,
  },
  [RoleName.RANSOMWARE]: {
    id: RoleName.RANSOMWARE,
    team: Team.BLACK_HAT,
    displayName: 'Ransomware',
    description: 'Silencia operaciones del objetivo',
    playerGuide:
      '`ransomware`: silencias a un jugador hasta el día siguiente (no actúa de noche ni vota). Cooldown de varias noches tras cada uso según tamaño de sala. Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 55,
  },
  [RoleName.SPYWARE]: {
    id: RoleName.SPYWARE,
    team: Team.BLACK_HAT,
    displayName: 'Spyware',
    description: 'Intercepta visitantes nocturnos',
    playerGuide:
      '`spy`: eliges un nodo; al amanecer ves qué otros jugadores lo visitaron y el **tipo** de actividad (sin roles). Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 15,
  },
  [RoleName.PHISHER]: {
    id: RoleName.PHISHER,
    team: Team.BLACK_HAT,
    displayName: 'Phisher',
    description: 'Redirige votos diurnos',
    playerGuide:
      '`phisher_redirect`: de noche marcas a un jugador y a quién debe votar en la **siguiente VOTACION** (su voto real se redirige). Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 10,
  },
  [RoleName.BRUTE_FORCE]: {
    id: RoleName.BRUTE_FORCE,
    team: Team.BLACK_HAT,
    displayName: 'Fuerza Bruta',
    description: 'Kill directo único',
    playerGuide:
      '`brute_force`: intentas eliminar directamente a un objetivo **una vez por partida** (sin esperar consenso). Sujeto a protect, honeypot y escudos. Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 22,
  },
  [RoleName.SNIFFER]: {
    id: RoleName.SNIFFER,
    team: Team.BLACK_HAT,
    displayName: 'Sniffer',
    description: 'Identifica el bando de un nodo',
    playerGuide:
      '`team_probe`: de noche sondeas un jugador vivo; recibes su **equipo** (System / Black Hat / Caótico), no el rol exacto. Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 18,
  },
  [RoleName.EXPLOIT_KIT]: {
    id: RoleName.EXPLOIT_KIT,
    team: Team.BLACK_HAT,
    displayName: 'Kit de Exploits',
    description: 'Anula protección EDR',
    playerGuide:
      '`exploit_strip`: marcas un nodo; el `protect` del Antivirus **no** aplica sobre él esta noche (kills y consenso sí pueden matarlo). Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 28,
  },
  [RoleName.BACKDOOR_IMPLANT]: {
    id: RoleName.BACKDOOR_IMPLANT,
    team: Team.BLACK_HAT,
    displayName: 'Implante Backdoor',
    description: 'Refuerza consenso contra un nodo',
    playerGuide:
      '`backdoor_plant`: el objetivo recibe +1 peso en el consenso hacker esta noche (más fácil de eliminar por votación coordinada). Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 24,
  },
  [RoleName.LATERAL_MOVE]: {
    id: RoleName.LATERAL_MOVE,
    team: Team.BLACK_HAT,
    displayName: 'Movimiento Lateral',
    description: 'Detecta nodos System',
    playerGuide:
      '`lateral_probe`: sabes si el objetivo es del bando **System** (sí/no), sin revelar rol. Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 17,
  },
  [RoleName.KEYLOGGER]: {
    id: RoleName.KEYLOGGER,
    team: Team.BLACK_HAT,
    displayName: 'Keylogger',
    description: 'Rastrea votos diurnos',
    playerGuide:
      '`vote_trace`: ves a quién votó el objetivo en la **última votación** resuelta (si participó). Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 13,
  },
  [RoleName.VULN_SCANNER]: {
    id: RoleName.VULN_SCANNER,
    team: Team.BLACK_HAT,
    displayName: 'Escáner de Vulnerabilidades',
    description: 'Detecta nodos comprometidos',
    playerGuide:
      '`vuln_scan`: sabes si el objetivo está **comprometido** (infectado o silenciado). Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 19,
  },
  [RoleName.CREDENTIAL_STEALER]: {
    id: RoleName.CREDENTIAL_STEALER,
    team: Team.BLACK_HAT,
    displayName: 'Robador de Credenciales',
    description: 'Identifica roles defensivos críticos',
    playerGuide:
      '`cred_probe`: el objetivo es DEFENSA_CRÍTICA (SysAdmin, Antivirus, SOC, Parcheador) o PERFIL_ESTÁNDAR. Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 21,
  },
  [RoleName.MITM_PROXY]: {
    id: RoleName.MITM_PROXY,
    team: Team.BLACK_HAT,
    displayName: 'Proxy MitM',
    description: 'Secuestra un voto hacker',
    playerGuide:
      '`mitm_hijack`: eliges un hacker vivo y hacia quién debe apuntar su `hacker_vote` esta noche (anulas su objetivo real). Conoces a los demás hackers. ' +
      BLACK_HAT_WIN,
    priority: 11,
  },

  [RoleName.TROLL]: {
    id: RoleName.TROLL,
    team: Team.CHAOTIC,
    displayName: 'Troll',
    description: 'Victoria por expulsión',
    playerGuide:
      '`troll_provoke`: dejas un mensaje anónimo en el feed público. **Victoria solitaria únicamente** si el grupo te expulsa por votación diurna  Eno ganas por habilidades nocturnas ni por quedar solo.',
    priority: 5,
  },
  [RoleName.WORM]: {
    id: RoleName.WORM,
    team: Team.CHAOTIC,
    displayName: 'Gusano',
    description: 'Infección progresiva',
    playerGuide:
      '`worm_infect`: infectas un nodo; cae tras dos noches sin `cure`. Tu primer kill directo nocturno falla (inmunidad); luego eres vulnerable. **Victoria solitaria** si quedas como único jugador vivo.',
    priority: 28,
  },
  [RoleName.CRYPTO_MINER]: {
    id: RoleName.CRYPTO_MINER,
    team: Team.CHAOTIC,
    displayName: 'Minero de Cripto',
    description: 'Escudos y soborno letal',
    playerGuide:
      'Una acción por noche: `mine_crypto` (+1 escudo, máx. 3, no minar el mismo nodo dos noches seguidas) o `crypto_bribe` (gasta 1 escudo ↁEkill directo). ' +
      'Escudos bloquean kills directos; infección madura te elimina. **Victoria solitaria** si quedas como único jugador vivo.',
    priority: 12,
  },
  [RoleName.ZERO_DAY]: {
    id: RoleName.ZERO_DAY,
    team: Team.CHAOTIC,
    displayName: 'Zero-Day',
    description: 'Asume identidad de un muerto',
    playerGuide:
      '`zero_day_assume` (1ÁEpartida): eliges un jugador **ya eliminado** y asumes su rol, equipo y habilidades. Los escaneos SOC reflejan tu rol asumido. ' +
      'Ganas con el bando del rol asumido o por victoria solitaria de Gusano/Minero si aplica.',
    priority: 65,
  },
  [RoleName.DATA_LEAKER]: {
    id: RoleName.DATA_LEAKER,
    team: Team.CHAOTIC,
    displayName: 'Filtrador',
    description: 'Filtra el bando de un nodo',
    playerGuide:
      '`data_leak`: filtras el **equipo** de un jugador al feed público de forma anónima al amanecer. No ganas con victoria de bando; compites por tu condición caótica o desempate tardío.',
    priority: 8,
  },
  [RoleName.SHADOW]: {
    id: RoleName.SHADOW,
    team: Team.CHAOTIC,
    displayName: 'Sombra',
    description: 'Enmascara un nodo ante el SOC',
    playerGuide:
      '`shadow_mask`: un jugador vivo aparece como ?? SEGURO en escaneos SOC **esta noche** (aunque sea hacker o caótico). No revela tu identidad.',
    priority: 14,
  },
  [RoleName.LOGIC_BOMB]: {
    id: RoleName.LOGIC_BOMB,
    team: Team.CHAOTIC,
    displayName: 'Bomba Lógica',
    description: 'Arma una trampa nocturna',
    playerGuide:
      '`logic_bomb`: armas una bomba en un nodo. Si **actúa** la noche siguiente, muere al resolver esa noche (antes de que surta efecto su acción).',
    priority: 16,
  },
  [RoleName.DNS_POISONER]: {
    id: RoleName.DNS_POISONER,
    team: Team.CHAOTIC,
    displayName: 'Envenenador DNS',
    description: 'Corrompe votos diurnos',
    playerGuide:
      '`dns_spoof`: envenenas el resolver DNS de un jugador. En la **próxima VOTACION**, su voto se redirige al azar hacia **otro** nodo vivo distinto al que eligió (caos puro, no eliges el destino). ' +
      'Tú apareces como ?? SEGURO en escaneos SOC la noche que lo usas. Los caóticos deben sobrevivir mientras System y hackers se destruyen.',
    priority: 9,
  },
  [RoleName.RANSOM_NOTE]: {
    id: RoleName.RANSOM_NOTE,
    team: Team.CHAOTIC,
    displayName: 'Nota de Rescate',
    description: 'Extorsión pública y silencio',
    playerGuide:
      '`ransom_note`: silencias a un jugador hasta el día siguiente y dejas un mensaje anónimo en el feed público.',
    priority: 11,
  },
  [RoleName.DROPPER]: {
    id: RoleName.DROPPER,
    team: Team.CHAOTIC,
    displayName: 'Dropper',
    description: 'Troyano que anula defensas',
    playerGuide:
      '`rigged_payload`: infectas la cadena de suministro de un nodo  Ela **próxima noche** ignora protect, cure y respaldo sobre él. ' +
      'Empiezas con 1 escudo caótico (bloquea un kill directo; infección madura lo atraviesa). Ganas +1 escudo al usar tu habilidad (máx. 2).',
    priority: 18,
  },
  [RoleName.SABOTEUR]: {
    id: RoleName.SABOTEUR,
    team: Team.CHAOTIC,
    displayName: 'Saboteador',
    description: 'Jam de señal personal',
    playerGuide:
      '`jam_hacker`: jammeas **tu propia señal** esta noche  Eapareces ?? SEGURO en escaneos SOC, el consenso hacker no puede eliminarte y sobrevives **un linchamiento** al día siguiente aunque tengas mayoría en tu contra.',
    priority: 13,
  },
  [RoleName.WHITE_NOISE]: {
    id: RoleName.WHITE_NOISE,
    team: Team.CHAOTIC,
    displayName: 'Ruido Blanco',
    description: 'Desinformación en el feed',
    playerGuide:
      '`noise_burst`: dejas un mensaje anónimo de ruido en el feed público (sin victoria solitaria).',
    priority: 6,
  },
  [RoleName.MIRAGE]: {
    id: RoleName.MIRAGE,
    team: Team.CHAOTIC,
    displayName: 'Espejismo',
    description: 'Te enmascaras ante el SOC',
    playerGuide:
      '`mirage_cloak`: te enmascaras a ti mismo  Elos escaneos SOC te verán como ?? SEGURO esta noche.',
    priority: 15,
  },
  [RoleName.CHAOS_ROUTER]: {
    id: RoleName.CHAOS_ROUTER,
    team: Team.CHAOTIC,
    displayName: 'Router del Caos',
    description: 'Desvía ataques unidireccionalmente',
    playerGuide:
      '`chaos_route`: eliges un **origen** y un **colateral**  Etodos los ataques nocturnos dirigidos al origen impactan al colateral (sin intercambio mutuo como BGP). ' +
      'Ideal para desviar fuego o perjudicar bandos enemigos.',
    priority: 17,
  },
};

export type RoleId = RoleName;
