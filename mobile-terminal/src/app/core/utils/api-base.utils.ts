import { environment } from '../../../environments/environment';

export const API_URL_STORAGE_KEY = 'fp_apiUrl';

export function getStoredApiUrl(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const v = localStorage.getItem(API_URL_STORAGE_KEY)?.trim();
  return v || null;
}

export function setStoredApiUrl(url: string): void {
  const trimmed = url.trim().replace(/\/$/, '');
  if (trimmed) localStorage.setItem(API_URL_STORAGE_KEY, trimmed);
  else localStorage.removeItem(API_URL_STORAGE_KEY);
}

function isTunnelHost(host: string): boolean {
  const h = host.toLowerCase();
  return h.includes('ngrok') || h.includes('loca.lt') || h.includes('localtunnel');
}

/** URL base del backend. Prioridad: localStorage �� environment �� ajuste LAN. */
export function resolveApiBase(): string {
  let base = (getStoredApiUrl() || environment.apiUrl).replace(/\/$/, '');
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;

  if (typeof window !== 'undefined' && !getStoredApiUrl()) {
    try {
      const parsed = new URL(base);
      const pageHost = window.location.hostname;
      const apiIsLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
      const pageIsLocal = pageHost === 'localhost' || pageHost === '127.0.0.1';

      // LAN: sustituir localhost por IP de la pagina (ionic serve en 192.168.x.x)
      if (apiIsLocal && !pageIsLocal && !isTunnelHost(pageHost)) {
        parsed.hostname = pageHost;
        base = parsed.origin;
      }
    } catch {
      /* mantener base */
    }
  }
  return base;
}

export function apiTunnelHeaders(): Record<string, string> {
  const base = resolveApiBase().toLowerCase();
  const headers: Record<string, string> = {};
  if (base.includes('ngrok') || base.includes('zrok')) headers['ngrok-skip-browser-warning'] = '69420';
  if (base.includes('loca.lt') || base.includes('localtunnel') || base.includes('zrok')) {
    headers['Bypass-Tunnel-Reminder'] = 'true';
  }
  if (base.includes('zrok')) {
    headers['skip_zrok_interstitial'] = 'true';
  }
  return headers;
}

export function networkErrorMessage(): string {
  return 'No se pudo contactar al servidor. Revisa tu conexion a internet o intenta de nuevo.';
}


