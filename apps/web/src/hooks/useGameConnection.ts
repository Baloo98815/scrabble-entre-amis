import { useCallback, useEffect, useState } from 'react';
import type { AckResponse, GameStatePayload, Letter, MoveAppliedPayload, Placement } from '@scrabble/shared';
import { getSocket } from '../api/socket.js';
import { useGameStore } from '../state/gameStore.js';

export interface ConnectionError {
  code: string;
  message: string;
}

export class MoveError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'MoveError';
  }
}

function unwrap<T>(res: AckResponse<T>): T {
  if (!res.ok) throw new MoveError(res.error.code, res.error.message);
  return res.data;
}

/** Connecte le socket à une partie, alimente le store, et expose les actions de jeu. */
export function useGameConnection(gameId: string | null): {
  connected: boolean;
  error: ConnectionError | null;
  start: () => Promise<GameStatePayload>;
  placeMove: (placements: Placement[]) => Promise<MoveAppliedPayload>;
  exchange: (letters: Letter[]) => Promise<MoveAppliedPayload>;
  pass: () => Promise<MoveAppliedPayload>;
} {
  const applyGameState = useGameStore((s) => s.applyGameState);
  const applyMoveApplied = useGameStore((s) => s.applyMoveApplied);
  const applyRackUpdate = useGameStore((s) => s.applyRackUpdate);
  const setPlayerConnection = useGameStore((s) => s.setPlayerConnection);
  const reset = useGameStore((s) => s.reset);

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<ConnectionError | null>(null);

  useEffect(() => {
    if (!gameId) return undefined;
    const socket = getSocket();
    let hasJoined = false;
    let cancelled = false;

    function join(): void {
      socket.emit('game:join', { gameId: gameId as string }, (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error);
          return;
        }
        hasJoined = true;
        setError(null);
        applyGameState(res.data);
      });
    }

    function handleConnect(): void {
      setConnected(true);
      join();
    }
    function handleDisconnect(): void {
      setConnected(false);
    }
    // Filet de sécurité : un payload inattendu qui ferait planter un handler ne doit jamais
    // laisser le client figé sur un état obsolète (ex. plus interactif après avoir validé un
    // coup, jusqu'à un rechargement manuel) — on logue l'erreur (pour enfin capter le
    // message exact si ça se reproduit) et on force une resynchronisation complète.
    function safely(label: string, fn: () => void): void {
      try {
        fn();
      } catch (err) {
        console.error(`[useGameConnection] erreur dans ${label}, resynchronisation :`, err);
        join();
      }
    }

    function handleGameState(payload: GameStatePayload): void {
      safely('handleGameState', () => applyGameState(payload));
    }
    function handleMoveApplied(payload: MoveAppliedPayload): void {
      safely('handleMoveApplied', () => applyMoveApplied(payload));
    }
    function handleRackUpdate(payload: { rack: Letter[] }): void {
      safely('handleRackUpdate', () => applyRackUpdate(payload.rack));
    }
    function handlePlayerDisconnected(payload: { gamePlayerId: string }): void {
      setPlayerConnection(payload.gamePlayerId, false);
    }
    function handlePlayerReconnected(payload: { gamePlayerId: string }): void {
      setPlayerConnection(payload.gamePlayerId, true);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('game:state', handleGameState);
    socket.on('move:applied', handleMoveApplied);
    socket.on('rack:update', handleRackUpdate);
    socket.on('game:playerDisconnected', handlePlayerDisconnected);
    socket.on('game:playerReconnected', handlePlayerReconnected);

    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    // Filet de sécurité contre une connexion silencieusement morte : le ping-timeout
    // interne de Socket.IO peut mettre jusqu'à ~45 s à détecter une coupure (et davantage si
    // la reconnexion échoue une première fois), en particulier sur un onglet resté en
    // arrière-plan pendant le tour de l'adversaire (les navigateurs ralentissent les timers
    // des onglets inactifs). Dès que l'onglet redevient visible/actif, ou que le réseau
    // revient, on force une resynchronisation immédiate plutôt que d'attendre ce délai.
    function resyncNow(): void {
      if (document.visibilityState !== 'visible') return;
      if (socket.connected) join();
      else socket.connect();
    }
    document.addEventListener('visibilitychange', resyncNow);
    window.addEventListener('focus', resyncNow);
    window.addEventListener('online', resyncNow);

    return () => {
      cancelled = true;
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('game:state', handleGameState);
      socket.off('move:applied', handleMoveApplied);
      socket.off('rack:update', handleRackUpdate);
      socket.off('game:playerDisconnected', handlePlayerDisconnected);
      socket.off('game:playerReconnected', handlePlayerReconnected);
      document.removeEventListener('visibilitychange', resyncNow);
      window.removeEventListener('focus', resyncNow);
      window.removeEventListener('online', resyncNow);
      if (hasJoined) socket.emit('game:leave', () => undefined);
      reset();
    };
  }, [gameId, applyGameState, applyMoveApplied, applyRackUpdate, setPlayerConnection, reset]);

  const start = useCallback(
    () => new Promise<GameStatePayload>((resolve, reject) => {
      getSocket().emit('game:start', (res) => {
        try {
          resolve(unwrap(res));
        } catch (err) {
          reject(err);
        }
      });
    }),
    [],
  );

  const placeMove = useCallback(
    (placements: Placement[]) =>
      new Promise<MoveAppliedPayload>((resolve, reject) => {
        getSocket().emit('move:place', { placements }, (res) => {
          try {
            resolve(unwrap(res));
          } catch (err) {
            reject(err);
          }
        });
      }),
    [],
  );

  const exchange = useCallback(
    (letters: Letter[]) =>
      new Promise<MoveAppliedPayload>((resolve, reject) => {
        getSocket().emit('move:exchange', { letters }, (res) => {
          try {
            resolve(unwrap(res));
          } catch (err) {
            reject(err);
          }
        });
      }),
    [],
  );

  const pass = useCallback(
    () =>
      new Promise<MoveAppliedPayload>((resolve, reject) => {
        getSocket().emit('move:pass', (res) => {
          try {
            resolve(unwrap(res));
          } catch (err) {
            reject(err);
          }
        });
      }),
    [],
  );

  return { connected, error, start, placeMove, exchange, pass };
}
