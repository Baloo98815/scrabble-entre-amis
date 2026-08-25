import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import type { Letter } from '@scrabble/shared';
import { ShuffleButton } from './ShuffleButton.js';
import { Tile } from './Tile.js';

export interface RackSlot {
  /** Index dans le chevalet complet (stable pour le drag & drop, y compris après un mélange). */
  index: number;
  letter: Letter;
}

interface RackProps {
  slots: RackSlot[];
  interactive: boolean;
  onShuffle: () => void;
}

export function Rack({ slots, interactive, onShuffle }: RackProps) {
  const ids = slots.map(({ index }) => `rack-${index}`);

  return (
    <div className="rack">
      <div className="rack__tiles">
        <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
          {slots.map(({ index, letter }) => (
            <Tile key={index} id={`rack-${index}`} index={index} letter={letter} interactive={interactive} />
          ))}
        </SortableContext>
      </div>
      <ShuffleButton onShuffle={onShuffle} />
    </div>
  );
}
