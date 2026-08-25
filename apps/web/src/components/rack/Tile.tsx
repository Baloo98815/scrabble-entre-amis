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
}

/**
 * Toujours réordonnable, même hors de son tour — seul le dépôt sur le plateau est bloqué
 * (par le drop cible en lecture seule côté Cell.tsx + le garde-fou dans handleDragEnd),
 * pas la manipulation du chevalet lui-même. Réorganiser sa main en attendant son tour n'a
 * aucune incidence sur la partie.
 */
export function Tile({ id, index, letter }: TileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { letter, index },
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
      className={`tile${isBlank ? ' tile--blank' : ''}${isDragging ? ' tile--dragging' : ''}`}
    >
      {isBlank ? '' : letter}
      {!isBlank && <span className="tile-value">{letterValue(letter)}</span>}
    </div>
  );
}
