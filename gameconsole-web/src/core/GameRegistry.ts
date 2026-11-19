import { GameSessionManager } from './GameSessionManager';
import { SnakeGame, BattleshipGame, HeadFootballGame } from '../games';

/**
 * Registra todos los juegos reales implementados en el GameSessionManager.
 */
export function registerAllGames(): void {
  const manager = GameSessionManager.getInstance();

  // 1. Snake Game
  manager.registerGame('snake', (playerId, dispatcher, options) => {
    return new SnakeGame(playerId, dispatcher, options);
  });

  // 2. Battleship Game
  manager.registerGame('battleship', (playerId, dispatcher, options) => {
    return new BattleshipGame(playerId, dispatcher, options);
  });

  // 3. Head Football Game
  manager.registerGame('head_football', (playerId, dispatcher, options) => {
    return new HeadFootballGame(playerId, dispatcher, options);
  });
}
