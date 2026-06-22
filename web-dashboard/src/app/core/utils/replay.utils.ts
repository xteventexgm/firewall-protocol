import { environment } from '../../../environments/environment';

function apiBase(): string {
  let base = environment.apiUrl.replace(/\/$/, '');
  if (!/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }
  return base;
}

function tunnelHeaders(base: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (base.toLowerCase().includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = '69420';
  }
  return headers;
}

/** Descarga el JSON de replay de una partida desde el backend. */
export async function downloadGameReplay(roomId: string): Promise<void> {
  const base = apiBase();
  const code = roomId.toUpperCase().trim();
  const res = await fetch(`${base}/api/games/${code}/replay`, { headers: tunnelHeaders(base) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'No se pudo descargar el replay');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${code}-replay.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Descarga el registro legible (.log) de una partida archivada en finishgame/. */
export async function downloadSessionLog(roomId: string): Promise<void> {
  const base = apiBase();
  const code = roomId.toUpperCase().trim();
  const res = await fetch(`${base}/api/games/${code}/session-log`, { headers: tunnelHeaders(base) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'No se pudo descargar el registro de sesión');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${code}.log`;
  anchor.click();
  URL.revokeObjectURL(url);
}
