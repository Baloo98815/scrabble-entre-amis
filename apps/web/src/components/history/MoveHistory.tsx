import { normalizeWord } from '@scrabble/shared';
import type { MoveHistoryEntry } from '../../state/deriveMoveSummary.js';

interface MoveHistoryProps {
  entries: MoveHistoryEntry[];
}

/** Même URL que la définition côté serveur : mot normalisé, en minuscules, sur 1mot.net. */
function definitionUrl(word: string): string {
  return `https://1mot.net/${encodeURIComponent(normalizeWord(word).toLowerCase())}`;
}

function describeNonPlaceMove(entry: MoveHistoryEntry): string {
  if (entry.type === 'EXCHANGE') return 'a échangé des lettres';
  return entry.triggeredBy === 'timeout' ? 'a passé (temps écoulé)' : 'a passé';
}

export function MoveHistory({ entries }: MoveHistoryProps) {
  if (entries.length === 0) {
    return <p className="move-history move-history--empty">Aucun coup joué pour l’instant.</p>;
  }

  return (
    <ul className="move-history">
      {entries.map((entry) => (
        <li key={`${entry.turnNumber}-${entry.gamePlayerId}`} className="move-history__item">
          <span className="move-history__pseudo">{entry.pseudo}</span>
          {entry.type === 'PLACE' && entry.words.length > 0 ? (
            <span className="move-history__words">
              {entry.words.map((word, i) => (
                <span key={`${word}-${i}`}>
                  {i > 0 && ', '}
                  <a
                    href={definitionUrl(word)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Définition de ${word} sur 1mot.net`}
                  >
                    {word}
                  </a>
                </span>
              ))}
            </span>
          ) : (
            <span className="move-history__words move-history__words--muted">{describeNonPlaceMove(entry)}</span>
          )}
          <span className="move-history__score">{entry.score > 0 ? `+${entry.score}` : entry.score}</span>
        </li>
      ))}
    </ul>
  );
}
