import * as path from 'path';

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 15;

// Use current working directory to locate data folder when server is started
export const DATA_DIR = path.join(process.cwd(), 'data');
export const GAMES_DIR = path.join(DATA_DIR, 'games');

export default { MIN_PLAYERS, MAX_PLAYERS, DATA_DIR, GAMES_DIR };
