import { environment } from '../../../environments/environment';

/** Descarga el JSON de replay de una partida desde el backend. */
export async function downloadGameReplay(roomId: string): Promise<void> {
  let base = environment.apiUrl.replace(/\/$/, '');
  if (!/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }
  const code = roomId.toUpperCase().trim();
  const headers: Record<string, string> = {};
  if (base.toLowerCase().includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = '69420';
  }
  const res = await fetch(`${base}/api/games/${code}/replay`, { headers });
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
