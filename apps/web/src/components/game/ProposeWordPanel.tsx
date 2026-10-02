import { useState, type FormEvent } from 'react';

interface ProposeWordPanelProps {
  /** Une proposition est déjà en cours de vote (la mienne ou non). */
  disabled: boolean;
  onPropose: (word: string) => Promise<void>;
}

/** Scrabbullshit : le joueur au tour saisit un mot absent du dictionnaire et le soumet au vote des autres. */
export function ProposeWordPanel({ disabled, onPropose }: ProposeWordPanelProps) {
  const [word, setWord] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!word.trim()) return;
    setError(null);
    setSending(true);
    try {
      await onPropose(word.trim());
      setWord('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Proposition impossible.');
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="propose-word" onSubmit={handleSubmit}>
      <label>
        Proposer un mot aux autres
        <input
          value={word}
          maxLength={40}
          placeholder="Mot absent du dictionnaire"
          onChange={(e) => setWord(e.target.value)}
          disabled={disabled || sending}
        />
      </label>
      <button type="submit" disabled={disabled || sending || !word.trim()}>
        Proposer
      </button>
      {error && <p className="form__error">{error}</p>}
    </form>
  );
}
