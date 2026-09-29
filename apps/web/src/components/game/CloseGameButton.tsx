import { useState } from 'react';
import type { GameSummary } from '@scrabble/shared';
import { ApiError } from '../../api/http.js';
import { closeGame } from '../../api/games.js';
import { ConfirmModal } from './ConfirmModal.js';

/** Vrai si la partie peut être clôturée par l'utilisateur courant (créateur, partie non terminée). */
export function canCloseGame(game: GameSummary): boolean {
  return (
    (game.status === 'WAITING' || game.status === 'IN_PROGRESS') &&
    game.players.some((p) => p.isYou && p.seat === 0)
  );
}

interface CloseGameButtonProps {
  game: GameSummary;
  onClosed: () => void;
}

/** Petit ✕ + confirmation : passe la partie en « terminée » pour tous ses joueurs. */
export function CloseGameButton({ game, onClosed }: CloseGameButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await closeGame(game.id);
      setConfirming(false);
      onClosed();
    } catch (err) {
      setConfirming(false);
      setError(err instanceof ApiError ? err.message : 'Impossible de clôturer la partie.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="history-list__remove"
        aria-label="Clôturer cette partie"
        title="Clôturer la partie"
        onClick={() => setConfirming(true)}
      >
        ✕
      </button>
      {error && <span className="form__error">{error}</span>}
      {confirming && (
        <ConfirmModal
          title="Clôturer cette partie ?"
          message={
            game.status === 'IN_PROGRESS'
              ? 'La partie en cours sera arrêtée et passera en « terminée » pour tous les joueurs.'
              : 'Elle passera en « terminée » pour tous les joueurs et ne sera plus proposée comme partie en cours.'
          }
          confirmLabel="Clôturer"
          loading={busy}
          onConfirm={confirm}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
