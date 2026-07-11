export interface ParsedRoleInfo {
  commandName?: string;
  skillDescription: string;
  winTitle?: string;
  winDescription?: string;
  winType?: 'system' | 'hacker' | 'chaos';
}

export function parseRoleCopy(text: string | undefined | null): ParsedRoleInfo {
  if (!text) {
    return { skillDescription: '' };
  }

  let raw = text.replace(/\s{2,}/g, ' ').trim();
  
  const result: ParsedRoleInfo = {
    skillDescription: ''
  };

  // 1. Extraer comando (ej: `forensic_trace`)
  const cmdMatch = raw.match(/`([^`]+)`:?/);
  if (cmdMatch) {
    result.commandName = cmdMatch[1];
    raw = raw.replace(cmdMatch[0], '').trim();
  } else {
    // A veces no hay un comando inicial claro, pero podría haber otros backticks
    raw = raw.replace(/`([^`]+)`/g, '$1');
  }

  // 2. Extraer condición de victoria
  const winMatch = raw.match(/(Victoria del Sistema:|Victoria Black Hat:|Victoria Hacker:|Victoria de los Hackers:|Victoria solitaria únicamente|Victoria solitaria|Victoria caótica:?)\s*(.*)/i);
  
  if (winMatch) {
    result.winTitle = winMatch[1].replace(':', '').trim();
    result.winDescription = winMatch[2].trim();
    raw = raw.replace(winMatch[0], '').trim();

    const titleLower = result.winTitle.toLowerCase();
    if (titleLower.includes('sistema')) result.winType = 'system';
    else if (titleLower.includes('hacker') || titleLower.includes('black hat')) result.winType = 'hacker';
    else result.winType = 'chaos';
  }

  // 3. Traducción de Lore para el resto de la descripción de habilidad
  const translations: Record<string, string> = {
    'nodo': 'jugador',
    'nodos': 'jugadores',
    'consenso hacker': 'votación secreta de hackers',
    'kills directos': 'ataques mortales',
    'kill directo': 'ataque mortal',
    'bajas': 'eliminados',
    'víctimas': 'eliminados',
    'cooldown': 'tiempo de recarga',
    'feed público': 'chat global',
    'linchamiento': 'expulsión diurna',
    'VOTACION': 'Votación diurna',
    'consenso nocturno': 'votación secreta nocturna',
    'escaneos SOC': 'investigaciones del equipo System'
  };

  for (const [key, value] of Object.entries(translations)) {
    const regex = new RegExp(`\\b${key}\\b`, 'gi');
    raw = raw.replace(regex, value);
  }

  // Limpiar formato residual Markdown (* y **)
  raw = raw.replace(/\*\*([^*]+)\*\*/g, '$1');
  raw = raw.replace(/\*([^*]+)\*/g, '$1');

  result.skillDescription = raw;

  return result;
}

/**
 * Función heredada para formateo simple si se usa en otros lugares de la app.
 */
export function formatRoleCopy(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
