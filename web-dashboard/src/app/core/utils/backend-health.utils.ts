import { environment } from '../../../environments/environment';

export interface BackendHealth {
  status: string;
  persistence: 'mongodb' | 'json';
  mongodb: { configured: boolean; connected: boolean; error: string | null };
  auth: { enabled: boolean; guestPlayAllowed: boolean };
  unavailable?: boolean;
}

export async function fetchBackendHealth(): Promise<BackendHealth> {
  let base = environment.apiUrl.replace(/\/$/, '');
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
  const headers: Record<string, string> = {};
  if (base.toLowerCase().includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = '69420';
  }
  try {
    const res = await fetch(`${base}/health`, { headers });
    if (!res.ok) return unavailable();
    return res.json() as Promise<BackendHealth>;
  } catch {
    return unavailable();
  }
}

function unavailable(): BackendHealth {
  return {
    status: 'error',
    persistence: 'json',
    mongodb: { configured: false, connected: false, error: 'Backend no alcanzable' },
    auth: { enabled: false, guestPlayAllowed: true },
    unavailable: true,
  };
}

export function persistenceLabel(health: BackendHealth | null): string {
  if (!health || health.unavailable) return 'Backend no disponible';
  if (health.persistence === 'mongodb') {
    return health.mongodb.connected ? 'MongoDB conectado' : `MongoDB error: ${health.mongodb.error ?? 'sin conexión'}`;
  }
  return 'Persistencia JSON local';
}
