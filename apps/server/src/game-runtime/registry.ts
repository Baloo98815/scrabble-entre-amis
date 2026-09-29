import type { GameRoomManager } from './GameRoomManager.js';

/**
 * Le manager est créé après `buildApp()` (il dépend de Socket.IO), alors que les routes REST en ont
 * parfois besoin (clôture d'une partie en mémoire). On l'expose donc via ce registre plutôt que
 * de décorer Fastify après son démarrage ; absent dans les tests de routes, où rien n'est en mémoire.
 */
let manager: GameRoomManager | undefined;

export function setGameRoomManager(m: GameRoomManager): void {
  manager = m;
}

export function getGameRoomManager(): GameRoomManager | undefined {
  return manager;
}
