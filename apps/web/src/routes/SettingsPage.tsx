import { Link } from 'react-router-dom';
import { CUSTOMIZABLE_COLORS } from '../hooks/useTheme.js';
import { useAuthContext } from '../state/AuthContext.js';
import { useThemeContext } from '../state/ThemeContext.js';

export function SettingsPage() {
  const { user, loading } = useAuthContext();
  const { theme, cycleTheme, customBase, customColors, setCustomColor, setCustomBase, resetCustom } =
    useThemeContext();

  if (loading) return <div className="page page--centered">Chargement…</div>;
  if (!user) {
    return (
      <div className="page page--centered">
        <p>Connecte-toi pour accéder aux paramètres.</p>
        <Link to="/login">Se connecter</Link>
      </div>
    );
  }

  function enableCustom(): void {
    // Le bouton flottant fait tourner clair → sombre → personnalisé ; on avance jusqu'à « custom ».
    if (theme === 'light') cycleTheme();
    if (theme !== 'custom') cycleTheme();
  }

  return (
    <div className="page">
      <h1>Paramètres</h1>
      <p>
        <Link to="/">← Retour à l'accueil</Link>
      </p>

      <section className="card">
        <h2>Thème personnalisé</h2>
        <p className="page__hint">
          Le bouton en haut à droite alterne clair → sombre → personnalisé. Les couleurs ci-dessous
          s'appliquent au thème personnalisé et sont enregistrées dans ce navigateur.
        </p>
        {theme !== 'custom' && (
          <p>
            <button type="button" onClick={enableCustom}>
              Activer le thème personnalisé
            </button>
          </p>
        )}
        <div className="settings__toolbar">
          <label>
            Palette de départ{' '}
            <select value={customBase} onChange={(e) => setCustomBase(e.target.value as 'light' | 'dark')}>
              <option value="light">Clair</option>
              <option value="dark">Sombre</option>
            </select>
          </label>
          <button type="button" onClick={resetCustom}>
            Réinitialiser les couleurs
          </button>
        </div>

        {CUSTOMIZABLE_COLORS.map((group) => (
          <fieldset key={group.group} className="settings__group">
            <legend>{group.group}</legend>
            <div className="settings__grid">
              {group.items.map(({ key, label }) => (
                <label key={key} className="settings__color">
                  <input
                    type="color"
                    value={customColors[key] ?? '#000000'}
                    onChange={(e) => setCustomColor(key, e.target.value)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </section>
    </div>
  );
}
