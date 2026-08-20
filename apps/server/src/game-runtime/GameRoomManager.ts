import type { DictionaryChecker } from '@scrabble/shared';
import { listInProgressGameIds } from '../services/persistence.service.js';
import type { IOServer } from '../sockets/types.js';
import { GameRoom } from './GameRoom.js';

/**
 * Registre en mémoire des parties vivantes (`Map<gameId, GameRoom>`). Recharge au
 * démarrage toutes les parties `IN_PROGRESS` depuis leurs snapshots en base, pour
 * résister à un redémarrage du serveur.
 */
export class GameRoomManager {
  private readonly rooms = new Map<string, GameRoom>();

  constructor(
    private readonly io: IOServer,
    private readonly dictionary: DictionaryChecker,
  ) {}

  async rehydrateInProgressGames(): Promise<number> {
    const ids = await listInProgressGameIds();
    for (const id of ids) {
      await this.getOrLoad(id);
    }
    return ids.length;
  }

  async getOrLoad(gameId: string): Promise<GameRoom> {
    const existing = this.rooms.get(gameId);
    if (existing) return existing;
    const room = await GameRoom.load(this.io, this.dictionary, gameId);
    this.rooms.set(gameId, room);
    return room;
  }

  get(gameId: string): GameRoom | undefined {
    return this.rooms.get(gameId);
  }

  /** Libère une partie de la mémoire une fois terminée et sans socket connecté. */
  sweepIfIdle(gameId: string): void {
    const room = this.rooms.get(gameId);
    if (room && room.hasNoActiveSockets()) {
      this.rooms.delete(gameId);
    }
  }
}
