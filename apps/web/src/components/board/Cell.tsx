import { useDroppable } from '@dnd-kit/core';
import type { BoardCell } from '@scrabble/shared';
import type { Direction } from '../../hooks/placementReducer.js';

interface CellProps {
  row: number;
  col: number;
  confirmedTile: BoardCell;
  pendingLetter: { letter: string; isBlank: boolean } | null;
  bonusLabel: string | null;
  isCenter: boolean;
  isSelected: boolean;
  direction: Direction;
  interactive: boolean;
  onSelect: (row: number, col: number) => void;
  onRemovePending: (row: number, col: number) => void;
}

export function Cell({
  row,
  col,
  confirmedTile,
  pendingLetter,
  bonusLabel,
  isCenter,
  isSelected,
  direction,
  interactive,
  onSelect,
  onRemovePending,
}: CellProps) {
  const isEmpty = !confirmedTile && !pendingLetter;
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${row}-${col}`,
    data: { row, col },
    disabled: !interactive || !isEmpty,
  });

  const letterToShow = confirmedTile?.letter ?? pendingLetter?.letter ?? null;
  const isBlankTile = confirmedTile?.isBlank ?? pendingLetter?.isBlank ?? false;

  function handleClick(): void {
    if (!interactive) return;
    if (pendingLetter) {
      onRemovePending(row, col);
      return;
    }
    if (isEmpty) onSelect(row, col);
  }

  const classNames = [
    'cell',
    isCenter ? 'cell--center' : '',
    confirmedTile ? 'cell--confirmed' : '',
    pendingLetter ? 'cell--pending' : '',
    isSelected ? 'cell--selected' : '',
    isOver ? 'cell--over' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={classNames}
      onClick={handleClick}
      disabled={!interactive && isEmpty}
      aria-label={letterToShow ? `Case ${row + 1},${col + 1} : ${letterToShow}` : `Case ${row + 1},${col + 1}`}
    >
      {letterToShow ? (
        <span className={`tile-letter${isBlankTile ? ' tile-letter--blank' : ''}`}>{letterToShow}</span>
      ) : (
        <>
          {isCenter && <span className="cell__bonus cell__bonus--center">★</span>}
          {!isCenter && bonusLabel && <span className="cell__bonus">{bonusLabel}</span>}
        </>
      )}
      {isSelected && <span className="cell__arrow">{direction === 'horizontal' ? '→' : '↓'}</span>}
    </button>
  );
}
