import { resolveApiBase, apiTunnelHeaders } from './api-base.utils';

export interface RoomStatusResponse {
  exists: boolean;
  phase: string | null;
  playerCount: number;
  connectedCount?: number;
  maxPlayers?: number;
  canJoin: boolean;
  canReconnect: boolean;

  /** true si la API no respondió (CORS/red); el join por socket sigue siendo la validación real. */
  unavailable?: boolean;
}

const UNAVAILABLE: RoomStatusResponse = {
  exists: false,
  phase: null,
  playerCount: 0,
  canJoin: false,
  canReconnect: false,
  unavailable: true,
};

export function isRoomStatusUnavailable(status: RoomStatusResponse): boolean {
  return status.unavailable === true;
}

export async function fetchRoomStatus(
  roomId: string,
  playerId?: string,
): Promise<RoomStatusResponse> {
  let base = resolveApiBase();
  const code = roomId.toUpperCase().trim();
  const query = playerId ? `?playerId=${encodeURIComponent(playerId)}` : '';
  const headers: Record<string, string> = { ...apiTunnelHeaders() };

  const maxRetries = 3;
  const retryDelay = 5000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${base}/api/games/${code}/status${query}`, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status >= 500 && attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, retryDelay));
          continue;
        }
        return { ...UNAVAILABLE, unavailable: false };
      }
      return res.json() as Promise<RoomStatusResponse>;
    } catch {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, retryDelay));
      }
    }
  }
  return UNAVAILABLE;
}
