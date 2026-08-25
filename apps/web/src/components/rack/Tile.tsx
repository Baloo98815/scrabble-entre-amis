import { useDraggable } from '@dnd-kit/core';
import { letterValue } from '@scrabble/shared';
import type { CSSProperties } from 'react';

interface TileProps {
  id: string;
  letter: string;
  interactive: boolean;
}

export function Tile({ id, letter, interactive }: TileProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { letter },
    disabled: !interactive,
  });

  const style: CSSProperties | undefined = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: isDragging ? 10 : undefined }
    : undefined;

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
