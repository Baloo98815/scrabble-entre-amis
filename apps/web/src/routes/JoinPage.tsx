import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { GameSummary } from '@scrabble/shared';
import { joinGame, previewGame } from '../api/games.js';
import { ApiError } from '../api/http.js';
import { useAuthContext } from '../state/AuthContext.js';
import { getRememberedPseudo, rememberPseudo } from '../utils/guestPseudo.js';

export function JoinPage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const { user } = useAuthContext();
  const navigate = useNavigate();

  const [game, setGame] = useState<GameSummary | null>(null);
  const [pseudo, setPseudo] = useState(getRememberedPseudo);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!inviteCode) return;
    setLoading(true);
    previewGame(inviteCode)
      .then((res) => setGame(res.game))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Partie introuvable.'))
      .finally(() => setLoading(false));
  }, [inviteCode]);

  async function handleJoin(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!inviteCode) return;
    setError(null);
    setJoining(true);
    try {
      const res = await joinGame(inviteCode, { pseudo: user ? undefined : pseudo.trim() });
      if (!user) rememberPseudo(pseudo);
      navigate(`/game/${res.game.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de rejoindre la partie.');
    } finally {
      setJoining(false);
    }
  }

  if (loading) return <div className="page page--centered">Chargement de la partie…</div>;
  if (!game) return <div className="page page--centered">{error ?? 'Partie introuvable.'}</div>;

  const alreadyIn = game.players.some((p) => p.isYou);
  const isFull = game.players.length >= game.maxPlayers;

  return (
    <div className="page page--centered">
      <h1>Rejoindre une partie</h1>
      <p>
        {game.players.length} / {game.maxPlayers} joueur(s) — statut : {game.status}
      </p>
      <ul className="join-preview__players">
        {game.players.map((p) => (
          <li key={p.gamePlayerId}>{p.pseudo}</li>
        ))}
      </ul>

      {alreadyIn ? (
        <button type="button" className="button--primary" onClick={() => navigate(`/game/${game.id}`)}>
          Continuer la partie
        </button>
      ) : isFull ? (
        <p className="form__error">Cette partie est complète.</p>
      ) : (
        <form className="form" onSubmit={handleJoin}>
          {!user && (
            <label>
              Ton pseudo
              <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} maxLength={24} required />
            </label>
          )}
          {error && <p className="form__error">{error}</p>}
          <button type="submit" className="button--primary" disabled={joining}>
            Rejoindre la partie
          </button>
        </form>
      )}
    </div>
  );
}
