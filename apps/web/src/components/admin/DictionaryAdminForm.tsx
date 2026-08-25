import { useState, type FormEvent } from 'react';
import { addDictionaryWord, removeDictionaryWord } from '../../api/dictionary.js';
import { ApiError } from '../../api/http.js';

interface Feedback {
  type: 'success' | 'error';
  text: string;
}

/** Réservé aux comptes isAdmin (cf. HomePage.tsx) : ajout/retrait de mots au dictionnaire à
 * chaud, sans redéploiement (route POST/DELETE /api/admin/dictionary déjà existante). */
export function DictionaryAdminForm() {
  const [word, setWord] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAdd(e: FormEvent): Promise<void> {
    e.preventDefault();
    const trimmed = word.trim();
    if (!trimmed) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await addDictionaryWord(trimmed);
      setFeedback({ type: 'success', text: `« ${res.word} » ajouté au dictionnaire.` });
      setWord('');
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof ApiError ? err.message : "Impossible d'ajouter ce mot." });
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(): Promise<void> {
    const trimmed = word.trim();
    if (!trimmed) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await removeDictionaryWord(trimmed);
      setFeedback({ type: 'success', text: `« ${res.word} » retiré (s'il avait été ajouté ici).` });
      setWord('');
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof ApiError ? err.message : 'Impossible de retirer ce mot.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h2>Administration — Dictionnaire</h2>
      <form className="form" onSubmit={handleAdd}>
        <label>
          Mot
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            maxLength={30}
            placeholder="ex : ZOUAVE"
            autoCapitalize="characters"
          />
        </label>
        {feedback && (
          <p className={feedback.type === 'error' ? 'form__error' : 'form__success'}>{feedback.text}</p>
        )}
        <div className="form__actions">
          <button type="submit" className="button--primary" disabled={loading || !word.trim()}>
            Ajouter
          </button>
          <button type="button" onClick={handleRemove} disabled={loading || !word.trim()}>
            Retirer
          </button>
        </div>
      </form>
    </section>
  );
}
