import { useState } from 'react';
import type { Letter } from '@scrabble/shared';

interface ExchangePanelProps {
  rack: Letter[];
  loading: boolean;
  onConfirm: (letters: Letter[]) => void;
  onCancel: () => void;
}

export function ExchangePanel({ rack, loading, onConfirm, onCancel }: ExchangePanelProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function toggle(index: number): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className="exchange-panel">
      <p>Sélectionne les lettres à échanger :</p>
      <div className="exchange-panel__tiles">
        {rack.map((letter, index) => (
          <button
            key={index}
            type="button"
            className={`tile tile--selectable${selected.has(index) ? ' tile--selected' : ''}`}
            onClick={() => toggle(index)}
          >
            {letter === '*' ? '' : letter}
          </button>
        ))}
      </div>
      <div className="exchange-panel__actions">
        <button type="button" onClick={onCancel} disabled={loading}>
          Annuler
        </button>
        <button
          type="button"
          className="button--primary"
          disabled={selected.size === 0 || loading}
          onClick={() => onConfirm([...selected].map((i) => rack[i]!))}
        >
          Confirmer l'échange ({selected.size})
        </button>
      </div>
    </div>
  );
}
