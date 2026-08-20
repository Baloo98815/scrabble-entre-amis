import type { Letter } from '@scrabble/shared';
import { ShuffleButton } from './ShuffleButton.js';
import { Tile } from './Tile.js';

export interface RackSlot {
  /** Index dans le chevalet complet (stable pour le drag & drop). */
  index: number;
  letter: Letter;
}

interface RackProps {
  slots: RackSlot[];
  interactive: boolean;
  onShuffle: () => void;
}

export function Rack({ slots, interactive, onShuffle }: RackProps) {
  return (
    <div className="rack">
      <div className="rack__tiles">
        {slots.map(({ index, letter }) => (
          <Tile key={index} id={`rack-${index}`} letter={letter} interactive={interactive} />
        ))}
      </div>
      <ShuffleButton onShuffle={onShuffle} />
    </div>
  );
}
