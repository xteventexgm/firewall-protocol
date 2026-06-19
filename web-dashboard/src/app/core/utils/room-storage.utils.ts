import { SavedRoom } from '../models/game-state.model';

const STORAGE_KEY = 'fp_dashboard_rooms';

export function loadSavedRooms(): SavedRoom[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedRoom[];
    return parsed
      .filter((r) => r.roomId && r.maxPlayers)
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export function saveRoom(room: SavedRoom): void {
  const rooms = loadSavedRooms().filter((r) => r.roomId !== room.roomId);
  rooms.unshift({ ...room, savedAt: Date.now() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
}

export function removeRoom(roomId: string): void {
  const rooms = loadSavedRooms().filter((r) => r.roomId !== roomId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
}
