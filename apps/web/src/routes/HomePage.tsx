import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createGame } from '../api/games.js';
import { ApiError } from '../api/http.js';
import { logout } from '../api/auth.js';
import { useAuthContext } from '../state/AuthContext.js';

export function HomePage() {
  const { user, loading, refresh } = useAuthContext();
  const navigate = useNavigate();

  const [maxPlayers, setMaxPlayers] = useState(4);
  const [timeoutEnabled, setTimeoutEnabled] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState(90);
  const [pseudo, setPseudo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        maxPlayers,
        turnTimeoutSeconds: timeoutEnabled ? timeoutSeconds : null,
        pseudo: user ? undefined : pseudo.trim(),
      });
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

      <section className="card">
        <h2>Créer une nouvelle partie</h2>
        <form className="form" onSubmit={handleCreate}>
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
    </div>
  );
}
