import { useEffect } from 'react';

interface TurnToastProps {
  visible: boolean;
  onDismiss: () => void;
  /** Durée d'affichage avant disparition automatique (ms). */
  duration?: number;
}

/**
 * Encart non bloquant « c'est ton tour » : apparaît en haut de l'écran quand le tour passe au
 * joueur, puis disparaît de lui-même. Volontairement non modal pour ne pas interrompre le jeu.
 */
export function TurnToast({ visible, onDismiss, duration = 8000 }: TurnToastProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onDismiss]);

  if (!visible) return null;

  return (
    <div className="turn-toast" role="status" aria-live="polite" onClick={onDismiss}>
      <span className="turn-toast__icon" aria-hidden="true">
        🎯
      </span>
      <span>C'est à toi de jouer !</span>
    </div>
  );
}
