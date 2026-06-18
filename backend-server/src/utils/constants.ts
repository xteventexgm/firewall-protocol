import * as path from 'path';
import { DATA_DIRECTORY } from '../config/env';

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 15;

export const DATA_DIR = DATA_DIRECTORY;
export const GAMES_DIR = path.join(DATA_DIR, 'games');

export default { MIN_PLAYERS, MAX_PLAYERS, DATA_DIR, GAMES_DIR };
