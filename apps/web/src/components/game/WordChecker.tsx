import { useState, type FormEvent } from 'react';
import { checkWord, fetchDefinition, type WordDefinition } from '../../api/games.js';

interface CheckResult {
  word: string;
  valid: boolean;
  definition: WordDefinition | null;
}

/** Champ "tester un mot" : vérifie sa présence dans le dictionnaire sans consommer de tour. */
export function WordChecker() {
  const [word, setWord] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    const trimmed = word.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      // Validité (notre dictionnaire) et définition (1mot.net) en parallèle : la définition
      // est un simple confort, elle ne doit pas retarder ni bloquer le verdict de validité.
      const [check, definition] = await Promise.all([
        checkWord(trimmed),
        fetchDefinition(trimmed).catch(() => null),
      ]);
      setResult({ ...check, definition });
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
        <>
          <p
            className={`word-checker__result${
              result.valid ? ' word-checker__result--valid' : ' word-checker__result--invalid'
            }`}
          >
            {result.word.toUpperCase()} {result.valid ? 'est valide ✓' : "n'est pas dans le dictionnaire ✗"}
          </p>
          {result.definition && result.definition.extracts.length > 0 && (
            <ul className="word-checker__definitions">
              {result.definition.extracts.map((extract, i) => (
                <li key={i} className="word-checker__definition">
                  {extract}
                </li>
              ))}
            </ul>
          )}
          {result.definition && (
            <a
              className="word-checker__link"
              href={result.definition.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {result.definition.extracts.length > 0 ? 'Lire sur 1mot.net ↗' : 'Chercher sur 1mot.net ↗'}
            </a>
          )}
        </>
      )}
    </form>
  );
}
