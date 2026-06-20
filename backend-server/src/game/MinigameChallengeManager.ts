/**
 * Desafíos de habilidad opcionales para acciones nocturnas.
 * Mejora engagement sin bloquear la acción si falla (resultado degradado).
 */
import { RoleName } from '../types/roles.types';

export interface MinigameChallenge {
  token: string;
  role: RoleName;
  type: 'pick_logs' | 'timing' | 'match_pair' | 'sequence';
  prompt: string;
  options?: string[];
  /** Respuesta correcta (índice o valor). */
  answer: string | number;
  expiresAt: number;
}

const challenges = new Map<string, MinigameChallenge>();

const LOG_OPTIONS = [
  { text: 'SSH brute-force desde IP desconocida', malicious: true },
  { text: 'Backup programado completado', malicious: false },
  { text: 'Tráfico C2 hacia dominio .onion', malicious: true },
  { text: 'Actualización de parches KB5023', malicious: false },
  { text: 'Exfiltración DNS tunneling', malicious: true },
  { text: 'Heartbeat de monitorización normal', malicious: false },
];

const PAIRS = [
  { sig: 'Trojan.Win32', threat: 'Malware' },
  { sig: 'CVE-2024-1234', threat: 'Exploit' },
  { sig: 'Phish.Email', threat: 'Ingeniería social' },
  { sig: 'Ransom.Lock', threat: 'Cifrado' },
];

function randomToken(): string {
  return `mg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Genera un desafío según rol. */
export function createChallenge(role: RoleName, playerId: string): MinigameChallenge {
  const token = randomToken();
  const expiresAt = Date.now() + 60_000;

  let challenge: MinigameChallenge;

  if (role === RoleName.SOC_ANALYST) {
    const malicious = LOG_OPTIONS.filter((l) => l.malicious);
    const correct = malicious[Math.floor(Math.random() * malicious.length)];
    const options = [...LOG_OPTIONS]
      .sort(() => Math.random() - 0.5)
      .slice(0, 4)
      .map((l) => l.text);
    if (!options.includes(correct.text)) options[0] = correct.text;
    challenge = {
      token,
      role,
      type: 'pick_logs',
      prompt: 'Selecciona el log MALICIOSO:',
      options: options.sort(() => Math.random() - 0.5),
      answer: correct.text,
      expiresAt,
    };
  } else if (role === RoleName.ANTIVIRUS) {
    const pair = PAIRS[Math.floor(Math.random() * PAIRS.length)];
    const wrong = PAIRS.filter((p) => p.threat !== pair.threat).map((p) => p.threat);
    const options = [pair.threat, wrong[0], wrong[1] ?? 'DDoS'].sort(() => Math.random() - 0.5);
    challenge = {
      token,
      role,
      type: 'match_pair',
      prompt: `Empareja firma "${pair.sig}" con la amenaza:`,
      options,
      answer: pair.threat,
      expiresAt,
    };
  } else if (role === RoleName.PENTESTER) {
    const zones = ['ROJO', 'AMARILLO', 'VERDE', 'ROJO'];
    const greenIdx = zones.indexOf('VERDE');
    challenge = {
      token,
      role,
      type: 'timing',
      prompt: 'Pulsa cuando la zona esté VERDE (timing):',
      options: zones,
      answer: greenIdx,
      expiresAt,
    };
  } else {
    const seq = ['FW', 'SCAN', 'ACK', 'DONE'];
    challenge = {
      token,
      role,
      type: 'sequence',
      prompt: `Confirma secuencia de protocolo (último paso):`,
      options: ['SYNC', 'ACK', 'DONE', 'RESET'],
      answer: 'DONE',
      expiresAt,
    };
  }

  challenges.set(`${playerId}:${token}`, challenge);
  return challenge;
}

export type MinigameResult = 'success' | 'failed' | 'skipped' | 'expired';

/** Valida respuesta; consume el token. */
export function validateChallenge(
  playerId: string,
  token: string | undefined,
  answer: string | number | undefined,
): MinigameResult {
  if (!token) return 'skipped';
  const key = `${playerId}:${token}`;
  const challenge = challenges.get(key);
  if (!challenge) return 'skipped';
  challenges.delete(key);

  if (Date.now() > challenge.expiresAt) return 'expired';
  if (answer === undefined || answer === null || answer === '') return 'failed';

  const normalized = String(answer).trim();
  const expected = String(challenge.answer).trim();
  return normalized === expected || Number(answer) === challenge.answer ? 'success' : 'failed';
}

/** Limpia desafíos expirados periódicamente. */
export function pruneExpiredChallenges(): void {
  const now = Date.now();
  for (const [key, c] of challenges) {
    if (c.expiresAt < now) challenges.delete(key);
  }
}
