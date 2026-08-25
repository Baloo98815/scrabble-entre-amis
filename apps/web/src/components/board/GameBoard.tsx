import { BOARD_SIZE, BONUS_GRID } from '@scrabble/shared';
import type { Board, Placement } from '@scrabble/shared';
import type { Direction } from '../../hooks/placementReducer.js';
import { Cell } from './Cell.js';

// Libellés volontairement courts : les cases font 34px de large, un texte plus long
// déborde et se fait rogner sur les cases en bord de plateau.
const BONUS_LABELS: Record<string, string> = {
  TW: 'MOT×3',
  DW: 'MOT×2',
  TL: 'L×3',
  DL: 'L×2',
};

// A-O pour les colonnes, comme au Scrabble physique.
const COLUMN_LABELS = Array.from({ length: BOARD_SIZE }, (_, i) => String.fromCharCode(65 + i));

interface GameBoardProps {
  board: Board;
  pending: Placement[];
  selected: { row: number; col: number } | null;
  direction: Direction;
  interactive: boolean;
  onSelect: (row: number, col: number) => void;
  onRemovePending: (row: number, col: number) => void;
}

export function GameBoard({ board, pending, selected, direction, interactive, onSelect, onRemovePending }: GameBoardProps) {
  const pendingByKey = new Map(pending.map((p) => [`${p.row},${p.col}`, p]));

  return (
    <div className="board-wrapper">
      <div className="board-coords">
        <div className="board-coords__corner" aria-hidden="true" />
        <div className="board-coords__cols" aria-hidden="true">
          {COLUMN_LABELS.map((label) => (
            <span key={label} className="board-coords__col">
              {label}
            </span>
          ))}
        </div>
        <div className="board-coords__rows" aria-hidden="true">
          {Array.from({ length: BOARD_SIZE }, (_, row) => (
            <span key={row} className="board-coords__row">
              {row + 1}
            </span>
          ))}
        </div>
        <div className="board" role="grid" aria-label="Plateau de Scrabble">
          {Array.from({ length: BOARD_SIZE }, (_, row) => (
            <div className="board__row" role="row" key={row}>
              {Array.from({ length: BOARD_SIZE }, (_, col) => {
                const bonus = BONUS_GRID[row]![col]!;
                const pendingHere = pendingByKey.get(`${row},${col}`) ?? null;
                return (
                  <Cell
                    key={col}
                    row={row}
                    col={col}
                    confirmedTile={board.cells[row]![col]!}
                    pendingLetter={pendingHere ? { letter: pendingHere.letter, isBlank: pendingHere.isBlank } : null}
                    bonusType={bonus.type}
                    bonusLabel={bonus.type ? (BONUS_LABELS[bonus.type] ?? null) : null}
                    isCenter={bonus.isCenter}
                    isSelected={selected?.row === row && selected?.col === col}
                    direction={direction}
                    interactive={interactive}
                    onSelect={onSelect}
                    onRemovePending={onRemovePending}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
