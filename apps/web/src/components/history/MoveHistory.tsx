import { bonusTotal, normalizeWord, type BonusState } from '@scrabble/shared';
import type { MoveHistoryEntry } from '../../state/deriveMoveSummary.js';

interface MoveHistoryProps {
  entries: MoveHistoryEntry[];
  /** Mode Scrabbullshit : bonus « +1 » ouvert sur le dernier coup. */
  bonus?: BonusState | null;
  /** Id du joueur courant (undefined pour un spectateur : le +1 s'affiche mais reste inactif). */
  myGamePlayerId?: string;
  onClickBonus?: () => void;
}

/** Même URL que la définition côté serveur : mot normalisé, en minuscules, sur 1mot.net. */
function definitionUrl(word: string): string {
  return `https://1mot.net/${encodeURIComponent(normalizeWord(word).toLowerCase())}`;
}

function describeNonPlaceMove(entry: MoveHistoryEntry): string {
  if (entry.type === 'EXCHANGE') return 'a échangé des lettres';
  return entry.triggeredBy === 'timeout' ? 'a passé (temps écoulé)' : 'a passé';
}

export function MoveHistory({ entries, bonus = null, myGamePlayerId, onClickBonus }: MoveHistoryProps) {
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
                  {bonus && bonus.turnNumber === entry.turnNumber && bonus.word === word && (
                    <BonusButton bonus={bonus} myGamePlayerId={myGamePlayerId} onClick={onClickBonus} />
                  )}
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

function BonusButton({
  bonus,
  myGamePlayerId,
  onClick,
}: {
  bonus: BonusState;
  myGamePlayerId?: string;
  onClick?: () => void;
}) {
  const clicks = bonus.voterIds.length;
  const alreadyClicked = !!myGamePlayerId && bonus.voterIds.includes(myGamePlayerId);
  const isAuthor = myGamePlayerId === bonus.authorId;
  const disabled = !onClick || !myGamePlayerId || alreadyClicked || isAuthor;
  const title = isAuthor
    ? 'Les autres peuvent féliciter ton mot'
    : alreadyClicked
      ? 'Tu as déjà mis un +1 sur ce mot'
      : 'Féliciter ce mot : +1 pour son auteur (1, 5 puis 10 points selon le nombre de +1)';
  return (
    <button type="button" className="bonus-button" disabled={disabled} onClick={onClick} title={title}>
      +1{clicks > 0 ? ` ×${clicks} (${bonusTotal(clicks)} pts)` : ''}
    </button>
  );
}
