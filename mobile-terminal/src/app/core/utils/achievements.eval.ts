import { PlayerRoomState } from '../models/game-state.model';
import { GameOverView } from './game-over.utils';

/**
 * Evaluates achievements at the end of the game based on the current room state and game over view.
 * Focuses on evaluating the subset of achievements that can be easily determined from the final state.
 *
 * @param gameOverView The visual game over information containing didWin and personal result.
 * @param state The current game state representing the end of the game.
 * @param myPlayerId The ID of the current player.
 * @param unlockedAchievements An array of achievement IDs that the player has already unlocked.
 * @param myTeam The current player's team (system, black_hat, chaotic).
 * @returns Array of achievement IDs that were newly unlocked during this evaluation.
 */
export function evaluateEndOfGameAchievements(
  gameOverView: GameOverView,
  state: PlayerRoomState,
  myPlayerId: string,
  unlockedAchievements: string[],
  myTeam: string | undefined
): string[] {
  const newUnlocks = new Set<string>();

  // If we already have it or we didn't win, skip win-based checks.
  if (gameOverView.didWin) {
    if (!unlockedAchievements.includes('first_win')) {
      newUnlocks.add('first_win');
    }

    if (myTeam === 'system' && !unlockedAchievements.includes('system_win')) {
      newUnlocks.add('system_win');
    }

    if (myTeam === 'black_hat' && !unlockedAchievements.includes('hacker_win')) {
      newUnlocks.add('hacker_win');
    }

    // flawless_victory: win without your team suffering casualties.
    if (!unlockedAchievements.includes('flawless_victory') && myTeam) {
      const myTeamPlayers = state.players.filter(p => p.team === myTeam);
      const allAlive = myTeamPlayers.every(p => p.isAlive);
      if (myTeamPlayers.length > 0 && allAlive) {
        newUnlocks.add('flawless_victory');
      }
    }
    
    // lone_wolf: Only survivor of your faction and won
    if (!unlockedAchievements.includes('lone_wolf') && myTeam) {
      const myTeamPlayers = state.players.filter(p => p.team === myTeam);
      const aliveMembers = myTeamPlayers.filter(p => p.isAlive);
      if (myTeamPlayers.length > 1 && aliveMembers.length === 1 && aliveMembers[0].id === myPlayerId) {
        newUnlocks.add('lone_wolf');
      }
    }
  }

  // survivor: reached the end of a game of > 10 days without being eliminated
  if (!unlockedAchievements.includes('survivor')) {
    const me = state.players.find(p => p.id === myPlayerId);
    if (me && me.isAlive && state.dayNumber > 10) {
      newUnlocks.add('survivor');
    }
  }

  // speedrunner: Finished in < 5 phases (days/nights). Usually dayNumber is counted. 
  if (gameOverView.didWin && !unlockedAchievements.includes('speedrunner')) {
    if ((state.dayNumber + state.nightNumber) < 5) {
      newUnlocks.add('speedrunner');
    }
  }

  // M16: Roles & Specifics
  const me = state.players.find(p => p.id === myPlayerId);
  if (me) {
    if (gameOverView.didWin && me.role === 'zero_day' && !unlockedAchievements.includes('zero_day_exploit')) {
      newUnlocks.add('zero_day_exploit');
    }
    // We cannot fully evaluate "Cirujano de red", "Trampa mortal", "Pingüino de hielo", "Caballo de Troya" 
    // or "Error 418" just from the final GameState without the full action log. 
    // Usually these would be triggered server-side or by specific client action logs.
    // However, if the info exists in a local log, it could be evaluated here.
    // For M16, we add the structure for them. 

    // Silencio de radio: Won without chatting (hard to evaluate accurately without chat log in state, but we provide the hook)
    if (gameOverView.didWin && !unlockedAchievements.includes('radio_silence')) {
      // Stub: assumes a hypothetical `me.messagesSent` or similar if added in future
      // if (me.messagesSent === 0) newUnlocks.add('radio_silence');
    }
  }

  return Array.from(newUnlocks);
}
