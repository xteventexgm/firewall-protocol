import { resolveApiBase, apiTunnelHeaders } from './api-base.utils';

export interface BackendHealth {
  status: string;
  persistence: 'mongodb' | 'json';
  mongodb: { configured: boolean; connected: boolean; error: string | null };
  auth: { enabled: boolean; guestPlayAllowed: boolean };
  unavailable?: boolean;
}

export async function fetchBackendHealth(): Promise<BackendHealth> {
  const base = resolveApiBase();
  try {
    const res = await fetch(`${base}/health`, { headers: apiTunnelHeaders() });
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
    mongodb: { configured: false, connected: false, error: 'No se pudo contactar al backend' },
    auth: { enabled: false, guestPlayAllowed: true },
    unavailable: true,
  };
}
