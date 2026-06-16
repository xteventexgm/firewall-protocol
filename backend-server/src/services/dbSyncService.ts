import * as fs from 'fs';
import * as path from 'path';
import { GAMES_DIR } from '../utils/constants';
import { GameState } from '../models/GameState';
import { logger } from '../utils/logger';

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(GAMES_DIR);

export function saveGameState(roomId: string, state: any) {
  try {
    const file = path.join(GAMES_DIR, `${roomId}.json`);
    fs.writeFileSync(file, JSON.stringify(state, null, 2), { encoding: 'utf8' });
    logger.info('Saved game state', roomId, file);
    return true;
  } catch (err: any) {
    logger.error('Failed to save game state', err.message || err);
    return false;
  }
}

export function loadGameState(roomId: string): any | null {
  try {
    const file = path.join(GAMES_DIR, `${roomId}.json`);
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf8');
    const obj = JSON.parse(raw);
    logger.info('Loaded game state', roomId);
    return obj;
  } catch (err: any) {
    logger.error('Failed to load game state', err.message || err);
    return null;
  }
}

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

export function listSavedGames(): string[] {
  try {
    ensureDir(GAMES_DIR);
    return fs.readdirSync(GAMES_DIR).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
  } catch (err: any) {
    logger.error('Failed to list saved games', err.message || err);
    return [];
  }
}

export default { saveGameState, loadGameState, deleteGameState, listSavedGames };
