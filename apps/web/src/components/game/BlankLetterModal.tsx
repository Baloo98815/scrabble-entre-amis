import { useState } from 'react';

interface BlankLetterModalProps {
  onConfirm: (letter: string) => void;
  onCancel: () => void;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function BlankLetterModal({ onConfirm, onCancel }: BlankLetterModalProps) {
  const [selected, setSelected] = useState('A');

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Choisir la lettre du joker">
      <div className="modal">
        <h2>Quelle lettre représente ce joker ?</h2>
        <div className="modal__letters">
          {ALPHABET.map((letter) => (
            <button
              key={letter}
              type="button"
              className={`modal__letter${selected === letter ? ' modal__letter--selected' : ''}`}
              onClick={() => setSelected(letter)}
            >
              {letter}
            </button>
          ))}
        </div>
        <div className="modal__actions">
          <button type="button" onClick={onCancel}>
            Annuler
          </button>
          <button type="button" className="button--primary" onClick={() => onConfirm(selected)}>
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}
