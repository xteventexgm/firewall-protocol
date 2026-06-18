/** Mapeo rol → tipo de acción nocturna (contrato backend). */
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
  Gusano: 'worm_kill',
  'Zero-Day': 'zero_day_assume',
};

export function getNightActionType(role: string | undefined): string | null {
  if (!role) return null;
  return ROLE_NIGHT_ACTION[role] ?? null;
}
