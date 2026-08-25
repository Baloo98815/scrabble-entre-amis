import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { letterValue } from '@scrabble/shared';
import type { CSSProperties } from 'react';

interface TileProps {
  id: string;
  /** Position dans le chevalet complet (rackOrder) — utilisée pour le drop sur le plateau
   * (via `letter`) et pour la réorganisation par glisser-déposer au sein du chevalet. */
  index: number;
  letter: string;
  interactive: boolean;
}

export function Tile({ id, index, letter, interactive }: TileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { letter, index },
    disabled: !interactive,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    zIndex: isDragging ? 10 : undefined,
  };

  const isBlank = letter === '*';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`tile${isBlank ? ' tile--blank' : ''}${isDragging ? ' tile--dragging' : ''}${
        interactive ? '' : ' tile--disabled'
      }`}
    >
      {isBlank ? '' : letter}
      {!isBlank && <span className="tile-value">{letterValue(letter)}</span>}
    </div>
  );
}
