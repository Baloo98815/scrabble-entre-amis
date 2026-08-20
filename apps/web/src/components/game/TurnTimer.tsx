import { useEffect, useState } from 'react';

interface TurnTimerProps {
  deadline: number | null;
}

export function TurnTimer({ deadline }: TurnTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadline === null) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (deadline === null) return null;

  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <span className={`turn-timer${secondsLeft <= 10 ? ' turn-timer--urgent' : ''}`}>⏱ {secondsLeft}s</span>
  );
}
