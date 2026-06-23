import { resolveApiBase, apiTunnelHeaders } from './api-base.utils';

export interface RoomStatusResponse {
  exists: boolean;
  phase: string | null;
  playerCount: number;
  connectedCount?: number;
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

  try {
    const res = await fetch(`${base}/api/games/${code}/status${query}`, { headers });
    if (!res.ok) {
      return { ...UNAVAILABLE, unavailable: false };
    }
    return res.json() as Promise<RoomStatusResponse>;
  } catch {
    return UNAVAILABLE;
  }
}
