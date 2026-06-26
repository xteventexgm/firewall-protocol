import type { GameArchiveCategory } from '../services/dbSyncService';

export interface ActiveRoomStatus {
  exists: boolean;
  phase: string | null;
  playerCount: number;
  connectedCount: number;
  canJoin: boolean;
  canReconnect: boolean;
}

export interface DBAdapter {
  save(roomId: string, state: any): boolean;
  load(roomId: string): any | null;
  loadOrArchive(roomId: string): any | null;
  loadOrArchiveAsync(roomId: string): Promise<any | null>;
  readSessionLog(roomId: string): string | null;
  readSessionLogAsync(roomId: string): Promise<string | null>;
  delete(roomId: string): boolean;
  archive(roomId: string, category: GameArchiveCategory, extra?: Record<string, unknown>): boolean;
  list(): string[];
  getStatus(roomId: string, playerId?: string): ActiveRoomStatus;
  warmCache?(): Promise<void>;
}
