import { useEffect, useState } from 'react';
import type { GameStatePayload, MoveAppliedPayload } from '@scrabble/shared';
import { getSocket } from '../api/socket.js';
import { useGameStore } from '../state/gameStore.js';
import type { ConnectionError } from './useGameConnection.js';

/**
 * Connexion en lecture seule à une partie (mode spectateur) : rejoint via `game:spectate`
 * (pas `game:join`), alimente le même store que la vue joueur, mais n'expose aucune action
 * de jeu — un spectateur ne peut par construction jamais émettre move:place/exchange/pass.
 */
export function useSpectateConnection(gameId: string | null): {
  connected: boolean;
  error: ConnectionError | null;
} {
  const applyGameState = useGameStore((s) => s.applyGameState);
  const applyMoveApplied = useGameStore((s) => s.applyMoveApplied);
  const reset = useGameStore((s) => s.reset);

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<ConnectionError | null>(null);

  useEffect(() => {
    if (!gameId) return undefined;
    const socket = getSocket();
    let cancelled = false;

    function spectate(): void {
      socket.emit('game:spectate', { gameId: gameId as string }, (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setError(null);
        applyGameState(res.data);
      });
    }

    function handleConnect(): void {
      setConnected(true);
      spectate();
    }
    function handleDisconnect(): void {
      setConnected(false);
    }
    // Même filet de sécurité que useGameConnection : un payload inattendu ne doit pas
    // planter silencieusement l'affichage.
    function handleGameState(payload: GameStatePayload): void {
      try {
        applyGameState(payload);
      } catch (err) {
        console.error('[useSpectateConnection] erreur dans handleGameState :', err);
      }
    }
    function handleMoveApplied(payload: MoveAppliedPayload): void {
      try {
        applyMoveApplied(payload);
      } catch (err) {
        console.error('[useSpectateConnection] erreur dans handleMoveApplied :', err);
      }
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('game:state', handleGameState);
    socket.on('move:applied', handleMoveApplied);

    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    // Même filet de sécurité que useGameConnection contre une connexion silencieusement
    // morte (onglet resté en arrière-plan, etc.) — resynchronise dès que l'onglet redevient
    // visible plutôt que d'attendre le ping-timeout interne de Socket.IO.
    function resyncNow(): void {
      if (document.visibilityState !== 'visible') return;
      if (socket.connected) spectate();
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
      document.removeEventListener('visibilitychange', resyncNow);
      window.removeEventListener('focus', resyncNow);
      window.removeEventListener('online', resyncNow);
      socket.emit('game:leave', () => undefined);
      reset();
    };
  }, [gameId, applyGameState, applyMoveApplied, reset]);

  return { connected, error };
}
