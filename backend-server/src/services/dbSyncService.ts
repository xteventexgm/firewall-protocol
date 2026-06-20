/**
 * Persistencia de partidas en disco (JSON).
 */
import * as fs from 'fs';
import * as path from 'path';
import { GAMES_DIR, FINISHED_GAMES_DIR, DELETED_GAMES_DIR } from '../utils/constants';
import { logger } from '../utils/logger';

export type GameArchiveCategory = 'finishgame' | 'deletegame';

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function archiveDir(category: GameArchiveCategory): string {
  return category === 'finishgame' ? FINISHED_GAMES_DIR : DELETED_GAMES_DIR;
}

/** Serializa y escribe el estado de la partida activa. */
export function saveGameState(roomId: string, state: any) {
  try {
    ensureDir(GAMES_DIR);
    const file = path.join(GAMES_DIR, `${roomId}.json`);
    fs.writeFileSync(file, JSON.stringify(state, null, 2), { encoding: 'utf8' });
    logger.info('[db] wrote file', { roomId, file, bytes: JSON.stringify(state).length });
    return true;
  } catch (err: any) {
    logger.error('Failed to save game state', err.message || err);
    return false;
  }
}

/** Carga JSON de partida activa o null si no existe. */
export function loadGameState(roomId: string): any | null {
  try {
    ensureDir(GAMES_DIR);
    const file = path.join(GAMES_DIR, `${roomId}.json`);
    if (!fs.existsSync(file)) {
      logger.debug('[db] file not found', { roomId, file });
      return null;
    }
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (err: any) {
    logger.error('Failed to load game state', err.message || err);
    return null;
  }
}

/** Mueve JSON activo a finishgame/ o deletegame/ y lo quita de games/. */
export function archiveGameState(roomId: string, category: GameArchiveCategory, extraMeta?: Record<string, unknown>) {
  try {
    const activeFile = path.join(GAMES_DIR, `${roomId}.json`);
    if (!fs.existsSync(activeFile)) {
      logger.info('[db] archive skip — no active file', { roomId, category });
      return false;
    }
    const raw = fs.readFileSync(activeFile, 'utf8');
    const state = JSON.parse(raw);
    const targetDir = archiveDir(category);
    ensureDir(targetDir);
    const payload = {
      archivedAt: new Date().toISOString(),
      archiveCategory: category,
      ...extraMeta,
      ...state,
    };
    fs.writeFileSync(path.join(targetDir, `${roomId}.json`), JSON.stringify(payload, null, 2), 'utf8');
    fs.unlinkSync(activeFile);
    logger.info('[db] archived', { roomId, category, targetDir });
    return true;
  } catch (err: any) {
    logger.error('Failed to archive game state', err.message || err);
    return false;
  }
}

/** Elimina el archivo JSON activo de una sala. */
export function deleteGameState(roomId: string) {
  try {
    const file = path.join(GAMES_DIR, `${roomId}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    logger.info('Deleted game state', roomId);
    return true;
  } catch (err: any) {
    logger.error('Failed to delete game state', err.message || err);
    return false;
  }
}

/** Lista roomIds con JSON en games/ (partidas activas). */
export function listSavedGames(): string[] {
  try {
    ensureDir(GAMES_DIR);
    return fs.readdirSync(GAMES_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
  } catch (err: any) {
    logger.error('Failed to list saved games', err.message || err);
    return [];
  }
}

/** Estado rápido para login/reconnect (solo partidas activas en games/). */
export function getActiveRoomStatus(roomId: string, playerId?: string): {
  exists: boolean;
  phase: string | null;
  playerCount: number;
  canJoin: boolean;
  canReconnect: boolean;
} {
  const data = loadGameState(roomId);
  if (!data) {
    return { exists: false, phase: null, playerCount: 0, canJoin: false, canReconnect: false };
  }
  const phase = data.phase ?? null;
  const playerCount = data.players?.length ?? 0;
  const canJoin = phase === 'LOBBY';
  const inProgress = phase && phase !== 'LOBBY' && phase !== 'FIN';
  const playerKnown = !playerId || (data.players ?? []).some((p: { id: string }) => p.id === playerId);
  const canReconnect = !!inProgress && playerKnown;
  return { exists: true, phase, playerCount, canJoin, canReconnect };
}

export default {
  saveGameState,
  loadGameState,
  deleteGameState,
  archiveGameState,
  listSavedGames,
  getActiveRoomStatus,
};
