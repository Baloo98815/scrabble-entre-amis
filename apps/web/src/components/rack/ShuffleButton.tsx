interface ShuffleButtonProps {
  onShuffle: () => void;
}

export function ShuffleButton({ onShuffle }: ShuffleButtonProps) {
  return (
    <button type="button" className="rack__shuffle" onClick={onShuffle} title="Mélanger les lettres du chevalet">
      🔀
    </button>
  );
}
