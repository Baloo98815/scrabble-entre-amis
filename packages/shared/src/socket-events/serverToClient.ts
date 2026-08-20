import type { Letter } from '../types.js';
import type { GameEndedPayload, GameStatePayload, MoveAppliedPayload, PlayerPublicState } from './payloads.js';

export interface ServerToClientEvents {
  'game:state': (payload: GameStatePayload) => void;
  'game:playerJoined': (payload: { player: PlayerPublicState }) => void;
  'game:playerLeft': (payload: { gamePlayerId: string }) => void;
  'game:playerDisconnected': (payload: { gamePlayerId: string }) => void;
  'game:playerReconnected': (payload: { gamePlayerId: string }) => void;
  'game:started': (payload: { turnDeadline: number | null }) => void;
  'move:applied': (payload: MoveAppliedPayload) => void;
  /** Émis uniquement au socket du joueur concerné — jamais en broadcast de room. */
  'rack:update': (payload: { rack: Letter[] }) => void;
  'game:ended': (payload: GameEndedPayload) => void;
  error: (payload: { code: string; message: string }) => void;
}
