/**
 * Desafíos de habilidad opcionales para acciones nocturnas.
 * Mejora engagement sin bloquear la acción si falla (resultado degradado).
 */
import { RoleName } from '../types/roles.types';

export interface MinigameChallenge {
  token: string;
  role: RoleName;
  type: 'pick_logs' | 'timing' | 'match_pair' | 'sequence' | 'trivia';
  objective: string;
  prompt: string;
  context?: string;
  options?: string[];
  successHint: string;
  failHint: string;
  answer: string | number;
  expiresAt: number;
}

export type MinigameResult = 'success' | 'failed' | 'skipped' | 'expired';

interface ResolvedChallenge {
  result: MinigameResult;
  answer?: string | number;
}

const challenges = new Map<string, MinigameChallenge>();
const resolved = new Map<string, ResolvedChallenge>();

const LOG_OPTIONS = [
  { text: 'Beacon C2 periódico hacia IP 185.220.x.x (cada 300s)', malicious: true },
  { text: 'Backup programado completado — checksum OK', malicious: false },
  { text: 'Exfiltración DNS tunneling hacia dominio .onion', malicious: true },
  { text: 'Actualización de parches KB5023 aplicada', malicious: false },
  { text: 'Movimiento lateral SMB desde host no inventariado', malicious: true },
  { text: 'Heartbeat de monitorización dentro de SLA', malicious: false },
  { text: 'Login SSH exitoso desde geolocalización atípica (3 intentos previos fallidos)', malicious: true },
  { text: 'Rotación de certificado TLS programada', malicious: false },
  { text: 'PowerShell -enc ejecutado desde cuenta de servicio', malicious: true },
  { text: 'Sincronización NTP con stratum 1 corporativo', malicious: false },
  { text: 'Credenciales admin usadas desde TOR exit node', malicious: true },
  { text: 'Escaneo de vulnerabilidades programado (Qualys)', malicious: false },
  { text: 'Proceso hijo de winword.exe lanza rundll32 sin firma', malicious: true },
  { text: 'Replicación DFS completada sin conflictos', malicious: false },
  { text: 'Beacon HTTP jitter 47s hacia dominio recién registrado', malicious: true },
];

const PAIRS = [
  { sig: 'Trojan.Win32.Emotet', threat: 'Malware', decoy: 'Exploit' },
  { sig: 'CVE-2024-1234 (RCE)', threat: 'Exploit', decoy: 'Ingeniería social' },
  { sig: 'Phish.Email.CredentialHarvest', threat: 'Ingeniería social', decoy: 'Cifrado' },
  { sig: 'Ransom.LockBit.Variant', threat: 'Cifrado', decoy: 'Malware' },
  { sig: 'Backdoor.CobaltStrike.Beacon', threat: 'Malware', decoy: 'DDoS' },
  { sig: 'Exploit.Log4Shell.JNDI', threat: 'Exploit', decoy: 'Cifrado' },
  { sig: 'Spyware.Pegasus.Mobile', threat: 'Malware', decoy: 'Ingeniería social' },
  { sig: 'DDoS.Mirai.Botnet', threat: 'DDoS', decoy: 'Exploit' },
  { sig: 'Social.Engineering.Vishing', threat: 'Ingeniería social', decoy: 'Malware' },
];

const TIMING_SEQUENCES = [
  {
    zones: ['ROJO', 'ROJO', 'VERDE', 'ROJO'],
    answer: 2,
    context: 'Ventanas: ROJO=peligro · AMARILLO=inestable · VERDE=ventana segura',
  },
  {
    zones: ['AMARILLO', 'VERDE', 'ROJO', 'ROJO'],
    answer: 1,
    context: 'Solo la ventana VERDE permite inyectar el exploit sin alerta.',
  },
  {
    zones: ['ROJO', 'AMARILLO', 'VERDE', 'AMARILLO'],
    answer: 2,
    context: 'El exploit requiere la tercera ventana VERDE del ciclo.',
  },
  {
    zones: ['VERDE', 'ROJO', 'ROJO', 'AMARILLO'],
    answer: 0,
    context: 'La primera ventana VERDE es la única sin IDS activo.',
  },
  {
    zones: ['ROJO', 'ROJO', 'AMARILLO', 'VERDE'],
    answer: 3,
    context: 'Espera la última ventana VERDE antes de explotar.',
  },
];

const SEQUENCE_CHALLENGES = [
  {
    context: 'FW → INSPECT → QUARANTINE → ?',
    options: ['LOG', 'ACK', 'RESET', 'BYPASS'],
    answer: 'LOG',
    prompt: 'Tras aislar un paquete, ¿qué paso obligatorio deja trazabilidad forense?',
  },
  {
    context: 'AUTH → MFA → SESSION → ?',
    options: ['GRANT', 'SYNC', 'DROP', 'SPOOF'],
    answer: 'GRANT',
    prompt: 'Si MFA es válido, ¿qué emite el servidor de sesión?',
  },
  {
    context: 'SCAN → CLASSIFY → ALERT → ?',
    options: ['DONE', 'RESET', 'SYNC', 'IGNORE'],
    answer: 'DONE',
    prompt: 'Cierra el pipeline SOC cuando el analista confirma el incidente:',
  },
  {
    context: 'PROBE → ENUM → EXPLOIT → ?',
    options: ['EXFIL', 'PERSIST', 'PATCH', 'LOGOUT'],
    answer: 'PERSIST',
    prompt: 'Tras explotar, ¿qué paso mantiene acceso en pentesting ético documentado?',
  },
  {
    context: 'DETECT → TRIAGE → CONTAIN → ?',
    options: ['ERADICATE', 'IGNORE', 'DEPLOY', 'BACKUP'],
    answer: 'ERADICATE',
    prompt: 'Después de contener, ¿cuál es el siguiente paso del IR playbook?',
  },
  {
    context: 'INGEST → NORMALIZE → CORRELATE → ?',
    options: ['ALERT', 'DELETE', 'BYPASS', 'SLEEP'],
    answer: 'ALERT',
    prompt: 'En el pipeline SIEM, ¿qué genera el analista tras correlacionar eventos?',
  },
  {
    context: 'HASH → QUARANTINE → ANALYZE → ?',
    options: ['REPORT', 'EXECUTE', 'FORWARD', 'SPOOF'],
    answer: 'REPORT',
    prompt: 'Tras analizar malware en sandbox, ¿qué acción cierra el flujo EDR?',
  },
];

const TRIVIA_CHALLENGES = [
  {
    objective: 'Identifica el vector MITRE más probable',
    prompt: 'Un usuario abre un adjunto .docm que ejecuta macros. ¿Técnica MITRE?',
    context: 'T1059=ejecución · T1566=phishing · T1078=cuenta válida · T1048=exfil',
    options: ['T1566 — Phishing', 'T1078 — Cuenta válida', 'T1048 — Exfil', 'T1059 — Solo ejecución'],
    answer: 'T1566 — Phishing',
    successHint: 'Correcto: el vector inicial fue ingeniería social por correo.',
    failHint: 'Incorrecto: el adjunto malicioso indica phishing (T1566), no solo ejecución.',
  },
  {
    objective: 'Prioriza la respuesta ante ransomware',
    prompt: 'Detectas cifrado masivo en fileserver. ¿Primera acción del playbook?',
    options: [
      'Aislar el segmento de red afectado',
      'Pagar rescate para recuperar tiempo',
      'Reiniciar todos los nodos a la vez',
      'Publicar logs en chat general',
    ],
    answer: 'Aislar el segmento de red afectado',
    successHint: 'Correcto: contención primero, luego erradicación y recuperación.',
    failHint: 'Incorrecto: sin aislar el segmento, el ransomware sigue propagándose.',
  },
  {
    objective: 'Diferencia tráfico legítimo de exfil encubierta',
    prompt: '¿Qué patrón sugiere exfiltración por DNS tunneling?',
    options: [
      'Consultas TXT largas y frecuentes a subdominios aleatorios',
      'Resolución A estándar a CDN conocido',
      'NTP sync cada 15 minutos',
      'Heartbeat HTTPS 200 OK al monitor',
    ],
    answer: 'Consultas TXT largas y frecuentes a subdominios aleatorios',
    successHint: 'Correcto: subdominios aleatorios + TXT voluminosos = túnel DNS.',
    failHint: 'Incorrecto: el tunneling DNS usa consultas anómalas, no tráfico CDN normal.',
  },
  {
    objective: 'Identifica el indicador de movimiento lateral',
    prompt: '¿Qué evento sugiere lateral movement en Active Directory?',
    options: [
      'Pass-the-hash entre workstations del mismo segmento',
      'Login fallido único desde IP externa',
      'Backup nocturno de SQL Server',
      'Actualización de GPO de escritorio',
    ],
    answer: 'Pass-the-hash entre workstations del mismo segmento',
    successHint: 'Correcto: PtH entre hosts internos es lateral movement clásico.',
    failHint: 'Incorrecto: el movimiento lateral usa credenciales robadas entre hosts internos.',
  },
  {
    objective: 'Evalúa un intento de phishing',
    prompt: 'Correo urgente del "CEO" pidiendo transferencia. ¿Vector más probable?',
    options: ['BEC (Business Email Compromise)', 'DDoS', 'SQL injection', 'ARP spoofing'],
    answer: 'BEC (Business Email Compromise)',
    successHint: 'Correcto: suplantación ejecutiva para fraude financiero.',
    failHint: 'Incorrecto: el escenario describe BEC, no ataque de red.',
  },
  {
    objective: 'Prioriza hardening',
    prompt: 'Servidor expuesto con RDP abierto a Internet. ¿Mitigación prioritaria?',
    options: [
      'VPN + MFA antes de acceso RDP',
      'Cambiar el wallpaper corporativo',
      'Aumentar RAM del servidor',
      'Desactivar antivirus para rendimiento',
    ],
    answer: 'VPN + MFA antes de acceso RDP',
    successHint: 'Correcto: reducir superficie y exigir MFA.',
    failHint: 'Incorrecto: RDP público requiere VPN y MFA, no cambios cosméticos.',
  },
  {
    objective: 'Detecta rootkit en endpoint',
    prompt: '¿Señal más fiable de posible rootkit?',
    options: [
      'Discrepancia entre procesos visibles en userland vs kernel hook',
      'Un solo pico de CPU al mediodía',
      'Usuario cambió contraseña voluntariamente',
      'Disco al 80% de capacidad',
    ],
    answer: 'Discrepancia entre procesos visibles en userland vs kernel hook',
    successHint: 'Correcto: hooks de kernel ocultan procesos del listado normal.',
    failHint: 'Incorrecto: rootkits manipulan la visibilidad a nivel kernel.',
  },
];

function randomToken(): string {
  return `mg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function pickOptions(correct: string, pool: string[], count = 4): string[] {
  const others = pool.filter((o) => o !== correct);
  const options = shuffle([correct, ...shuffle(others).slice(0, count - 1)]);
  return shuffle(options);
}

function challengeKey(playerId: string, token: string): string {
  return `${playerId}:${token}`;
}

export interface MinigameContext {
  roomId: string;
  nightNumber: number;
}

interface UsageState {
  night: number;
  used: Set<string>;
  last: string | null;
}

const usageByPlayer = new Map<string, UsageState>();

function usageKey(roomId: string, playerId: string): string {
  return `${roomId}:${playerId}`;
}

/** Evita repetir el mismo reto en la noche y consecutivamente entre noches. */
function pickFromPool<T>(
  pool: T[],
  getId: (item: T) => string,
  ctx: MinigameContext,
  playerId: string,
): T {
  const key = usageKey(ctx.roomId, playerId);
  let usage = usageByPlayer.get(key);
  if (!usage || usage.night !== ctx.nightNumber) {
    usage = { night: ctx.nightNumber, used: new Set(), last: usage?.last ?? null };
    usageByPlayer.set(key, usage);
  }

  let candidates = pool.filter((item) => !usage!.used.has(getId(item)));
  if (candidates.length === 0) {
    candidates = [...pool];
    usage.used.clear();
  }
  if (usage.last && candidates.length > 1) {
    const filtered = candidates.filter((item) => getId(item) !== usage!.last);
    if (filtered.length > 0) candidates = filtered;
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const id = getId(pick);
  usage.used.add(id);
  usage.last = id;
  return pick;
}

/** Genera un desafío según rol (sin repetir en la misma noche). */
export function createChallenge(
  role: RoleName,
  playerId: string,
  ctx: MinigameContext,
): MinigameChallenge {
  const token = randomToken();
  const expiresAt = Date.now() + 75_000;

  let challenge: MinigameChallenge;

  if (role === RoleName.SOC_ANALYST) {
    const malicious = LOG_OPTIONS.filter((l) => l.malicious);
    const correct = pickFromPool(malicious, (l) => l.text, ctx, playerId);
    const allTexts = LOG_OPTIONS.map((l) => l.text);
    challenge = {
      token,
      role,
      type: 'pick_logs',
      objective: 'Detecta la anomalía real: compromiso activo, no mantenimiento legítimo',
      prompt: '¿Cuál entrada del SIEM indica actividad hostil confirmada?',
      context: 'Dos entradas parecen rutinarias pero solo una es benigna con certeza.',
      options: pickOptions(correct.text, allTexts),
      answer: correct.text,
      successHint: 'Correcto: tu escaneo nocturno tendrá máxima precisión.',
      failHint: 'Incorrecto: confundiste ruido operativo con compromiso. El escaneo saldrá degradado.',
      expiresAt,
    };
  } else if (role === RoleName.ANTIVIRUS) {
    const pair = pickFromPool(PAIRS, (p) => p.sig, ctx, playerId);
    const wrongThreats = [...new Set(PAIRS.map((p) => p.threat).filter((t) => t !== pair.threat))];
    const options = pickOptions(pair.threat, [...wrongThreats, pair.decoy, 'DDoS']);
    challenge = {
      token,
      role,
      type: 'match_pair',
      objective: 'Clasifica el IOC con su vector de ataque principal',
      prompt: `La firma "${pair.sig}" corresponde a qué categoría de amenaza?`,
      context: 'No confundas el payload con el vector de entrega.',
      options,
      answer: pair.threat,
      successHint: 'Correcto: la cura/acción antivirus será más efectiva.',
      failHint: 'Incorrecto: mala clasificación. La acción funcionará con menor eficacia.',
      expiresAt,
    };
  } else if (role === RoleName.PENTESTER) {
    const seq = pickFromPool(TIMING_SEQUENCES, (s) => s.zones.join('|'), ctx, playerId);
    challenge = {
      token,
      role,
      type: 'timing',
      objective: 'Sincroniza el exploit en la ventana segura del objetivo',
      prompt: '¿En qué posición aparece la ventana VERDE?',
      context: seq.context,
      options: seq.zones.map((z, i) => `${i + 1}. ${z}`),
      answer: `${seq.answer + 1}. VERDE`,
      successHint: 'Correcto: exploit sincronizado. Mayor impacto en la noche.',
      failHint: 'Incorrecto: fuera de ventana. El exploit se ejecutará con menor precisión.',
      expiresAt,
    };
  } else if (
    role === RoleName.DDOS ||
    role === RoleName.ROOTKIT ||
    role === RoleName.RANSOMWARE ||
    role === RoleName.SPYWARE ||
    role === RoleName.PHISHER
  ) {
    const trivia = pickFromPool(TRIVIA_CHALLENGES, (t) => t.prompt, ctx, playerId);
    challenge = {
      token,
      role,
      type: 'trivia',
      objective: trivia.objective,
      prompt: trivia.prompt,
      context: trivia.context,
      options: shuffle(trivia.options),
      answer: trivia.answer,
      successHint: trivia.successHint,
      failHint: trivia.failHint,
      expiresAt,
    };
  } else {
    const seq = pickFromPool(SEQUENCE_CHALLENGES, (s) => s.prompt, ctx, playerId);
    challenge = {
      token,
      role,
      type: 'sequence',
      objective: 'Completa el pipeline de seguridad sin saltar pasos críticos',
      prompt: seq.prompt,
      context: `Secuencia: ${seq.context}`,
      options: shuffle(seq.options),
      answer: seq.answer,
      successHint: 'Correcto: protocolo validado. Tu acción nocturna será más fiable.',
      failHint: 'Incorrecto: paso inválido en el pipeline. La acción seguirá, pero degradada.',
      expiresAt,
    };
  }

  challenges.set(challengeKey(playerId, token), challenge);
  return challenge;
}

export function toChallengePayload(challenge: MinigameChallenge) {
  return {
    token: challenge.token,
    type: challenge.type,
    objective: challenge.objective,
    prompt: challenge.prompt,
    context: challenge.context,
    options: challenge.options,
    successHint: challenge.successHint,
    failHint: challenge.failHint,
    expiresAt: challenge.expiresAt,
  };
}

/** Intenta responder sin consumir el reto si falla. */
export function tryChallengeAnswer(
  playerId: string,
  token: string,
  answer: string | number | undefined,
): { result: MinigameResult; challenge?: MinigameChallenge } {
  const key = challengeKey(playerId, token);
  const challenge = challenges.get(key);
  if (!challenge) return { result: 'skipped' };

  if (Date.now() > challenge.expiresAt) {
    challenges.delete(key);
    return { result: 'expired', challenge };
  }

  if (answer === undefined || answer === null || answer === '') {
    return { result: 'failed', challenge };
  }

  const normalized = String(answer).trim();
  const expected = String(challenge.answer).trim();
  const ok = normalized === expected || Number(answer) === challenge.answer;

  if (!ok) {
    return { result: 'failed', challenge };
  }

  challenges.delete(key);
  resolved.set(key, { result: 'success', answer });
  return { result: 'success', challenge };
}

export function skipChallenge(playerId: string, token: string): MinigameResult {
  const key = challengeKey(playerId, token);
  if (!challenges.has(key)) return 'skipped';
  challenges.delete(key);
  resolved.set(key, { result: 'skipped' });
  return 'skipped';
}

/** Resuelve resultado al enviar la acción nocturna. */
export function resolveForNightAction(
  playerId: string,
  token: string | undefined,
  answer: string | number | undefined,
): MinigameResult {
  if (!token) return 'skipped';
  const key = challengeKey(playerId, token);
  const done = resolved.get(key);
  if (done) {
    resolved.delete(key);
    return done.result;
  }

  const challenge = challenges.get(key);
  if (!challenge) return 'skipped';
  challenges.delete(key);

  if (Date.now() > challenge.expiresAt) return 'expired';
  if (answer === undefined || answer === null || answer === '') return 'failed';

  const normalized = String(answer).trim();
  const expected = String(challenge.answer).trim();
  return normalized === expected || Number(answer) === challenge.answer ? 'success' : 'failed';
}

/** @deprecated Usar resolveForNightAction */
export function validateChallenge(
  playerId: string,
  token: string | undefined,
  answer: string | number | undefined,
): MinigameResult {
  return resolveForNightAction(playerId, token, answer);
}

export function pruneExpiredChallenges(): void {
  const now = Date.now();
  for (const [key, c] of challenges) {
    if (c.expiresAt < now) challenges.delete(key);
  }
}
