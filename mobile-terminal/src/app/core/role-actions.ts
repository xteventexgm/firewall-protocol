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

export function needsSecondaryTarget(role: string | undefined): boolean {
  return role === 'Enrutador BGP' || role === 'Phisher';
}

export function getSecondaryTargetLabel(role: string | undefined): string {
  if (role === 'Enrutador BGP') return 'Nodo destino (intercambio)';
  if (role === 'Phisher') return 'Redirigir voto hacia';
  return 'Segundo objetivo';
}

export function getNightActionLabel(role: string | undefined): string {
  const labels: Record<string, string> = {
    'Analista SOC': 'Escanear nodo',
    Antivirus: 'Proteger nodo',
    Pentester: 'Eliminar nodo',
    'Deep Freeze': 'Congelar nodo',
    'Enrutador BGP': 'Intercambiar tráfico',
    Honeypot: 'Arrastrar al honeypot',
    'DDoS Operator': 'Votar eliminación',
    Rootkit: 'Votar eliminación',
    Ransomware: 'Secuestrar nodo',
    Spyware: 'Espionar nodo',
    Phisher: 'Redirigir víctima',
    Gusano: 'Propagar ataque',
    'Zero-Day': 'Asumir identidad (muerto)',
  };
  return role ? (labels[role] ?? 'Seleccionar objetivo') : 'Seleccionar objetivo';
}
