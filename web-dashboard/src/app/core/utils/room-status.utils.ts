import { environment } from '../../../environments/environment';

export interface RoomStatusResponse {
  exists: boolean;
  phase: string | null;
  playerCount: number;
  canJoin: boolean;
  canReconnect: boolean;
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
  let base = environment.apiUrl.replace(/\/$/, '');
  if (!/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }
  const code = roomId.toUpperCase().trim();
  const query = playerId ? `?playerId=${encodeURIComponent(playerId)}` : '';
  const headers: Record<string, string> = {};
  if (base.toLowerCase().includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = '69420';
  }

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
