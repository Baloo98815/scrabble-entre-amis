import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { GameSummary } from '@scrabble/shared';
import { previewGame } from '../api/games.js';
import { ApiError } from '../api/http.js';
import { GameBoard } from '../components/board/GameBoard.js';
import { PlayerList } from '../components/players/PlayerList.js';
import { MoveHistory } from '../components/history/MoveHistory.js';
import { ConnectionBanner } from '../components/game/ConnectionBanner.js';
import { useSpectateConnection } from '../hooks/useSpectateConnection.js';
import { useGameStore } from '../state/gameStore.js';

/** Vue en lecture seule d'une partie, accessible via /watch/:inviteCode sans y jouer. */
export function SpectatePage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const store = useGameStore();

  const [game, setGame] = useState<GameSummary | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!inviteCode) return;
    setLoading(true);
    previewGame(inviteCode)
      .then((res) => setGame(res.game))
      .catch((err) => setPreviewError(err instanceof ApiError ? err.message : 'Partie introuvable.'))
      .finally(() => setLoading(false));
  }, [inviteCode]);

  const { connected, error: connectionError } = useSpectateConnection(game?.id ?? null);

  if (!inviteCode) return <div className="page page--centered">Lien invalide.</div>;
  if (loading) return <div className="page page--centered">Chargement de la partie…</div>;
  if (!game) return <div className="page page--centered">{previewError ?? 'Partie introuvable.'}</div>;

  if (!connected || store.status === 'IDLE') {
    return (
      <div className="page page--centered">
        {connectionError ? <p className="form__error">{connectionError.message}</p> : <p>Connexion à la partie…</p>}
      </div>
    );
  }

  return (
    <div className="page game-page">
      <aside className="game-page__sidebar">
        <ConnectionBanner connected={connected} />
        <p className="page__hint">Mode spectateur — lecture seule.</p>
        <PlayerList players={store.players} currentTurnIndex={store.currentTurnIndex} showRackCount />
        <h2>Derniers mots joués</h2>
        <MoveHistory entries={store.moveHistory} />
      </aside>

      <main className="game-page__main">
        {store.status === 'WAITING' ? (
          <p>La partie n'a pas encore commencé.</p>
        ) : (
          store.board && (
            <GameBoard
              board={store.board}
              pending={[]}
              selected={null}
              direction="horizontal"
              interactive={false}
              onSelect={() => undefined}
              onRemovePending={() => undefined}
            />
          )
        )}
      </main>
    </div>
  );
}
