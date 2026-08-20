import { useState, type FormEvent } from 'react';
import { checkWord } from '../../api/games.js';

/** Champ "tester un mot" : vérifie sa présence dans le dictionnaire sans consommer de tour. */
export function WordChecker() {
  const [word, setWord] = useState('');
  const [result, setResult] = useState<{ word: string; valid: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    const trimmed = word.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      setResult(await checkWord(trimmed));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="word-checker" onSubmit={handleSubmit}>
      <label htmlFor="word-checker-input">Tester un mot</label>
      <div className="word-checker__row">
        <input
          id="word-checker-input"
          value={word}
          onChange={(e) => {
            setWord(e.target.value);
            setResult(null);
          }}
          placeholder="ex : ZINC"
          maxLength={15}
        />
        <button type="submit" disabled={loading || !word.trim()}>
          Vérifier
        </button>
      </div>
      {result && (
        <p
          className={`word-checker__result${
            result.valid ? ' word-checker__result--valid' : ' word-checker__result--invalid'
          }`}
        >
          {result.word.toUpperCase()} {result.valid ? 'est valide ✓' : "n'est pas dans le dictionnaire ✗"}
        </p>
      )}
    </form>
  );
}
