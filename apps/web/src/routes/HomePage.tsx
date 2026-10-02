import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { GameMode, GameSummary } from '@scrabble/shared';
import { activeGames, createGame } from '../api/games.js';
import { ApiError } from '../api/http.js';
import { logout } from '../api/auth.js';
import { CloseGameButton, canCloseGame } from '../components/game/CloseGameButton.js';
import { DictionaryAdminForm } from '../components/admin/DictionaryAdminForm.js';
import { useAuthContext } from '../state/AuthContext.js';
import { getRememberedPseudo, rememberPseudo } from '../utils/guestPseudo.js';

export function HomePage() {
  const { user, loading, refresh } = useAuthContext();
  const navigate = useNavigate();

  const [mode, setMode] = useState<GameMode>('CLASSIC');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [timeoutEnabled, setTimeoutEnabled] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState(90);
  const [pseudo, setPseudo] = useState(getRememberedPseudo);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [ongoing, setOngoing] = useState<GameSummary[]>([]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    activeGames()
      .then((res) => !cancelled && setOngoing(res.games))
      .catch(() => !cancelled && setOngoing([]));
    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  async function handleCreate(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!user && pseudo.trim().length < 2) {
      setError('Choisis un pseudo (2 caractères minimum).');
      return;
    }
    setSubmitting(true);
    try {
      const { game } = await createGame({
        mode,
        maxPlayers,
        turnTimeoutSeconds: timeoutEnabled ? timeoutSeconds : null,
        pseudo: user ? undefined : pseudo.trim(),
      });
      if (!user) rememberPseudo(pseudo);
      navigate(`/game/${game.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de créer la partie.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout(): Promise<void> {
    await logout();
    await refresh();
  }

  return (
    <div className="page">
      <header className="page__header">
        <h1>Scrabble en ligne</h1>
        {!loading && (
          <div className="page__header-actions">
            {user ? (
              <>
                <span>Connecté en tant que {user.pseudo}</span>
                <Link to="/history">Mon historique</Link>
                <button type="button" className="link-button" onClick={handleLogout}>
                  Se déconnecter
                </button>
              </>
            ) : (
              <Link to="/login">Se connecter / créer un compte</Link>
            )}
          </div>
        )}
      </header>

      {ongoing.length > 0 && (
        <section className="card">
          <h2>{ongoing.length > 1 ? 'Tes parties en cours' : 'Ta partie en cours'}</h2>
          <ul className="history-list">
            {ongoing.map((game) => (
              <li key={game.id} className="history-list__item">
                <Link to={`/game/${game.id}`} className="button--primary ongoing__link">
                  Rejoindre la partie
                </Link>{' '}
                {game.status === 'WAITING' ? 'en attente de joueurs' : 'en cours'} -{' '}
                {game.players.map((p) => (p.isYou ? `${p.pseudo} (toi)` : p.pseudo)).join(', ')}{' '}
                {canCloseGame(game) && (
                  <CloseGameButton game={game} onClosed={() => setOngoing((c) => c.filter((g) => g.id !== game.id))} />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Créer une nouvelle partie</h2>
        <form className="form" onSubmit={handleCreate}>
          <label>
            Mode de jeu
            <select value={mode} onChange={(e) => setMode(e.target.value as GameMode)}>
              <option value="CLASSIC">Classic</option>
              <option value="SCRABBULLSHIT">Scrabbullshit</option>
            </select>
          </label>
          {mode === 'SCRABBULLSHIT' && (
            <p className="page__hint">
              +1 sur le mot qui vient d’être joué (1, 5 ou 10 points selon le nombre de +1) et propositions de mots
              soumises au vote des autres joueurs.
            </p>
          )}

          <label>
            Nombre de joueurs
            <select value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))}>
              {[2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <label className="form__checkbox">
            <input
              type="checkbox"
              checked={timeoutEnabled}
              onChange={(e) => setTimeoutEnabled(e.target.checked)}
            />
            Limiter le temps par tour
          </label>
          {timeoutEnabled && (
            <label>
              Durée par tour (secondes)
              <input
                type="number"
                min={15}
                max={600}
                value={timeoutSeconds}
                onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
              />
            </label>
          )}

          {!user && (
            <label>
              Ton pseudo
              <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} maxLength={24} required />
            </label>
          )}

          {error && <p className="form__error">{error}</p>}

          <button type="submit" className="button--primary" disabled={submitting}>
            Créer la partie
          </button>
        </form>
      </section>

      <p className="page__hint">
        Pour rejoindre une partie créée par un ami, ouvre simplement le lien qu'il t'a envoyé.
      </p>

      {user?.isAdmin && <DictionaryAdminForm />}
    </div>
  );
}
