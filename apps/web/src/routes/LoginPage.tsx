import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, registerAccount } from '../api/auth.js';
import { ApiError } from '../api/http.js';
import { useAuthContext } from '../state/AuthContext.js';

export function LoginPage() {
  const { refresh } = useAuthContext();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        await registerAccount({ email, password, pseudo });
      }
      await refresh();
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page page--centered">
      <h1>{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h1>
      <form className="form" onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {mode === 'register' && (
          <label>
            Pseudo
            <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} required minLength={2} maxLength={24} />
          </label>
        )}
        <label>
          Mot de passe
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        {error && <p className="form__error">{error}</p>}
        <button type="submit" className="button--primary" disabled={loading}>
          {mode === 'login' ? 'Se connecter' : "S'inscrire"}
        </button>
      </form>
      <button
        type="button"
        className="link-button"
        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
      >
        {mode === 'login' ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
      </button>
    </div>
  );
}
