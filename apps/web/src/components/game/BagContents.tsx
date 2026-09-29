import { useMemo } from 'react';
import { BLANK, FRENCH_LETTER_DISTRIBUTION, type Board, type Letter } from '@scrabble/shared';
import { computeUnseenLetters } from '../../utils/unseenLetters.js';

interface BagContentsProps {
  bagCount: number;
  board: Board | null;
  ownRack: Letter[];
}

const LETTERS = [...Object.keys(FRENCH_LETTER_DISTRIBUTION), BLANK];

/**
 * Le serveur ne révèle que la taille du sac : le détail affiché ici est celui des lettres non
 * vues (sac + chevalets adverses), déduit du plateau et de son propre chevalet.
 */
export function BagContents({ bagCount, board, ownRack }: BagContentsProps) {
  const unseen = useMemo(() => computeUnseenLetters(board, ownRack), [board, ownRack]);

  return (
    <section className="bag-contents" aria-label="Lettres restantes">
      <p className="bag-contents__total">
        Il reste <strong>{bagCount}</strong> tuile{bagCount > 1 ? 's' : ''} dans le sac.
      </p>
      <ul className="bag-contents__grid">
        {LETTERS.map((letter) => {
          const count = unseen[letter] ?? 0;
          return (
            <li key={letter} className={count === 0 ? 'bag-contents__cell bag-contents__cell--empty' : 'bag-contents__cell'}>
              <span className="bag-contents__letter">{letter === BLANK ? '?' : letter}</span>
              <span className="bag-contents__count">{count}</span>
            </li>
          );
        })}
      </ul>
      <p className="page__hint">Lettres que tu n’as pas encore vues : elles peuvent être dans le sac ou sur les chevalets de tes adversaires.</p>
    </section>
  );
}
