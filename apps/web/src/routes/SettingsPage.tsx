import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CUSTOMIZABLE_COLORS, parseThemeJson, serializeTheme } from '../hooks/useTheme.js';
import { useAuthContext } from '../state/AuthContext.js';
import { useThemeContext } from '../state/ThemeContext.js';

export function SettingsPage() {
  const { user, loading } = useAuthContext();
  const {
    theme,
    cycleTheme,
    customBase,
    customColors,
    setCustomColor,
    setCustomBase,
    resetCustom,
    savedThemes,
    saveTheme,
    loadTheme,
    deleteTheme,
    applyImported,
  } = useThemeContext();
  const [themeName, setThemeName] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function exportTheme(): void {
    const name = themeName.trim() || undefined;
    const json = serializeTheme({ name, base: customBase, colors: customColors });
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `theme-scrabble${name ? `-${name.replace(/[^\w-]+/g, '_')}` : ''}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importTheme(file: File | undefined): Promise<void> {
    if (!file) return;
    try {
      const imported = parseThemeJson(await file.text());
      applyImported(imported);
      if (imported.name) setThemeName(imported.name);
      setMessage({
        kind: 'ok',
        text: `Thème importé${imported.name ? ` : ${imported.name}` : ''}. Pense à l’enregistrer pour le garder.`,
      });
    } catch (err) {
      setMessage({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Import impossible.',
      });
    }
    if (fileInput.current) fileInput.current.value = '';
  }

  function submitSave(): void {
    const name = themeName.trim();
    if (!name) return;
    saveTheme(name);
    setMessage({ kind: 'ok', text: `Thème « ${name} » enregistré.` });
  }

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
              Enregistrer et Activer le thème personnalisé
            </button>
          </p>
        )}
        <div className="settings__toolbar">
          <label>
            Palette de départ{' '}
            <select
              value={customBase}
              onChange={(e) => setCustomBase(e.target.value as 'light' | 'dark')}
            >
              <option value="light">Clair</option>
              <option value="dark">Sombre</option>
            </select>
          </label>
          <button type="button" onClick={resetCustom}>
            Réinitialiser les couleurs
          </button>
        </div>

        <fieldset className="settings__group">
          <legend>Thèmes enregistrés</legend>
          <div className="settings__toolbar">
            <input
              type="text"
              value={themeName}
              maxLength={40}
              placeholder="Nom du thème"
              aria-label="Nom du thème"
              onChange={(e) => setThemeName(e.target.value)}
            />
            <button type="button" onClick={submitSave} disabled={!themeName.trim()}>
              Enregistrer sous ce nom
            </button>
            <button type="button" onClick={exportTheme}>
              Exporter (JSON)
            </button>
            <button type="button" onClick={() => fileInput.current?.click()}>
              Importer (JSON)
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => void importTheme(e.target.files?.[0])}
            />
          </div>
          {message && (
            <p
              role={message.kind === 'error' ? 'alert' : 'status'}
              style={{ color: `var(--${message.kind === 'error' ? 'error' : 'success'})` }}
            >
              {message.text}
            </p>
          )}
          {savedThemes.length === 0 ? (
            <p className="page__hint">Aucun thème enregistré.</p>
          ) : (
            <ul className="settings__themes">
              {savedThemes.map((t) => (
                <li key={t.name}>
                  <strong>{t.name}</strong>{' '}
                  <button
                    type="button"
                    onClick={() => {
                      loadTheme(t.name);
                      setThemeName(t.name);
                    }}
                  >
                    Appliquer
                  </button>{' '}
                  <button
                    type="button"
                    onClick={() => deleteTheme(t.name)}
                    aria-label={`Supprimer ${t.name}`}
                  >
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

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
