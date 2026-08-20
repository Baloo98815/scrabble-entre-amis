import type { PlayerPublicState } from '@scrabble/shared';

interface PlayerListProps {
  players: PlayerPublicState[];
  currentTurnIndex: number;
  showRackCount: boolean;
}

export function PlayerList({ players, currentTurnIndex, showRackCount }: PlayerListProps) {
  const sorted = [...players].sort((a, b) => a.seat - b.seat);

  return (
    <ul className="player-list">
      {sorted.map((p) => (
        <li
          key={p.gamePlayerId}
          className={`player-list__item${p.seat === currentTurnIndex ? ' player-list__item--active' : ''}`}
        >
          <span
            className={`player-list__status${p.connected ? '' : ' player-list__status--offline'}`}
            title={p.connected ? 'Connecté' : 'Déconnecté'}
            aria-hidden="true"
          />
          <span className="player-list__pseudo">
            {p.pseudo}
            {p.isYou ? ' (toi)' : ''}
          </span>
          {showRackCount && <span className="player-list__rack-count">{p.rackCount} lettres</span>}
          <span className="player-list__score">{p.score} pts</span>
        </li>
      ))}
    </ul>
  );
}
