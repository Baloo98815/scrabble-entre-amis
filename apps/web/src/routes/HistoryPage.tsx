import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GameSummary } from '@scrabble/shared';
import { gameDetail, myGames } from '../api/games.js';
import { MoveHistory } from '../components/history/MoveHistory.js';
import type { MoveHistoryEntry } from '../state/deriveMoveSummary.js';
import { useAuthContext } from '../state/AuthContext.js';

/** Coups d'une partie, chargés à la demande depuis la base (source de vérité de l'historique). */
function GameMoves({ game }: { game: GameSummary }) {
  const [entries, setEntries] = useState<MoveHistoryEntry[] | null>(null);
  const [error, setError] = useState(false);

  function load(open: boolean): void {
    if (!open || entries !== null) return;
    setError(false);
    gameDetail(game.id)
      .then(({ game: detail }) =>
        setEntries(
          detail.moves.map((m) => ({
            turnNumber: m.turnNumber,
            gamePlayerId: m.gamePlayerId,
            pseudo: game.players.find((p) => p.gamePlayerId === m.gamePlayerId)?.pseudo ?? 'Joueur',
            type: m.type,
            words: m.wordsFormed?.map((w) => w.word) ?? [],
            score: m.score,
            triggeredBy: m.triggeredBy,
          })),
        ),
      )
      .catch(() => setError(true));
  }

  return (
    <details className="history-list__moves" onToggle={(e) => load(e.currentTarget.open)}>
      <summary>Voir les coups joués</summary>
      {error ? (
        <p>Impossible de charger les coups.</p>
      ) : entries === null ? (
        <p>Chargement…</p>
      ) : (
        <MoveHistory entries={entries} />
      )}
    </details>
  );
}

export function HistoryPage() {
  const { user, loading: authLoading } = useAuthContext();
  const [games, setGames] = useState<GameSummary[] | null>(null);

  useEffect(() => {
    if (!user) return;
    myGames().then((res) => setGames(res.games));
  }, [user]);

  if (authLoading) return <div className="page page--centered">Chargement…</div>;
  if (!user) {
    return (
      <div className="page page--centered">
        <p>Connecte-toi pour voir ton historique de parties.</p>
        <Link to="/login">Se connecter</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Mon historique de parties</h1>
      <p>
        <Link to="/">← Retour à l'accueil</Link>
      </p>
      {games === null ? (
        <p>Chargement…</p>
      ) : games.length === 0 ? (
        <p>Tu n'as pas encore joué de partie.</p>
      ) : (
        <ul className="history-list">
          {games.map((game) => (
            <li key={game.id} className="history-list__item">
              <Link to={`/game/${game.id}`}>
                Partie du {new Date(game.createdAt).toLocaleString('fr-FR')} — {game.status}
              </Link>
              <ul className="history-list__players">
                {game.players.map((p) => (
                  <li key={p.gamePlayerId}>
                    {p.pseudo}
                    {p.isYou ? ' (toi)' : ''} : {p.score} pts
                  </li>
                ))}
              </ul>
              {game.status !== 'WAITING' && <GameMoves game={game} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
