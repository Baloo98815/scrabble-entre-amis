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
  onShuffle: () => void;
}

/** Le chevalet reste manipulable (réorganiser, mélanger) même hors de son tour — seule la
 * pose sur le plateau est réservée à son tour (cf. Tile.tsx). */
export function Rack({ slots, onShuffle }: RackProps) {
  const ids = slots.map(({ index }) => `rack-${index}`);

  return (
    <div className="rack">
      <div className="rack__tiles">
        <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
          {slots.map(({ index, letter }) => (
            <Tile key={index} id={`rack-${index}`} index={index} letter={letter} />
          ))}
        </SortableContext>
      </div>
      <ShuffleButton onShuffle={onShuffle} />
    </div>
  );
}
