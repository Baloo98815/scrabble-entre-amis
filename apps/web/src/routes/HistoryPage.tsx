import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GameSummary } from '@scrabble/shared';
import { myGames } from '../api/games.js';
import { useAuthContext } from '../state/AuthContext.js';

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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
