import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { Letter } from '@scrabble/shared';
import { GameBoard } from '../components/board/GameBoard.js';
import { Rack } from '../components/rack/Rack.js';
import { PlayerList } from '../components/players/PlayerList.js';
import { MoveHistory } from '../components/history/MoveHistory.js';
import { WordChecker } from '../components/game/WordChecker.js';
import { BlankLetterModal } from '../components/game/BlankLetterModal.js';
import { ConnectionBanner } from '../components/game/ConnectionBanner.js';
import { ExchangePanel } from '../components/game/ExchangePanel.js';
import { TurnTimer } from '../components/game/TurnTimer.js';
import { TurnToast } from '../components/game/TurnToast.js';
import { ConfirmModal } from '../components/game/ConfirmModal.js';
import { CopyableLink } from '../components/game/CopyableLink.js';
import { useGameConnection, MoveError } from '../hooks/useGameConnection.js';
import { useKeyboardPlacement } from '../hooks/useKeyboardPlacement.js';
import { useLivePreviewScore } from '../hooks/useLivePreviewScore.js';
import { useGameStore } from '../state/gameStore.js';

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const store = useGameStore();
  const { connected, error: connectionError, start, placeMove, exchange, pass } = useGameConnection(gameId ?? null);

  const [rackOrder, setRackOrder] = useState<Letter[]>([]);
  const rackKey = [...store.yourRack].sort().join('');
  useEffect(() => {
    setRackOrder(store.yourRack);
    // Ne resynchronise l'ordre d'affichage que lorsque le CONTENU du chevalet change
    // (après un coup) — un simple shuffle local ne doit pas être écrasé entre-temps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rackKey]);

  const me = store.players.find((p) => p.isYou);
  const isMyTurn = store.status === 'IN_PROGRESS' && me?.seat === store.currentTurnIndex;
  const canPlace = isMyTurn;

  const placement = useKeyboardPlacement(store.board, rackOrder, canPlace);
  const previewScore = useLivePreviewScore(store.board, placement.pending);

  const [pendingBlankDrop, setPendingBlankDrop] = useState<{ row: number; col: number } | null>(null);
  const [exchangeMode, setExchangeMode] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hideRack, setHideRack] = useState(false);
  const [showTurnToast, setShowTurnToast] = useState(false);
  const [showPassConfirm, setShowPassConfirm] = useState(false);

  // Déclenche le toast « c'est ton tour » uniquement sur la TRANSITION pas-mon-tour -> mon-tour,
  // pas à chaque re-render où isMyTurn reste vrai (sinon il se rouvrirait en boucle).
  const wasMyTurn = useRef(isMyTurn);
  useEffect(() => {
    if (isMyTurn && !wasMyTurn.current) setShowTurnToast(true);
    wasMyTurn.current = isMyTurn;
  }, [isMyTurn]);

  function handleDragEnd(event: DragEndEvent): void {
    try {
      const { active, over } = event;
      if (!over) return;
      const source = active.data.current as { letter: string; index: number } | undefined;
      if (!source) return;

      // Réorganiser son chevalet (y compris hors de son tour) n'a aucune incidence sur la
      // partie — seule la pose sur le plateau doit attendre son tour.
      const boardTarget = over.data.current as { row: number; col: number } | undefined;
      if (boardTarget && typeof boardTarget.row === 'number') {
        if (!canPlace) return;
        if (source.letter === '*') {
          setPendingBlankDrop({ row: boardTarget.row, col: boardTarget.col });
        } else {
          placement.placeLetterAt(boardTarget.row, boardTarget.col, source.letter, false);
        }
        return;
      }

      // Sinon la cible est un autre emplacement du chevalet (useSortable) : on réordonne
      // l'affichage plutôt que de poser une lettre.
      const rackTarget = over.data.current as { index: number } | undefined;
      if (rackTarget && typeof rackTarget.index === 'number' && rackTarget.index !== source.index) {
        setRackOrder(arrayMove(rackOrder, source.index, rackTarget.index));
      }
    } catch (err) {
      // Ne jamais laisser un glisser-déposer inattendu planter la page en silence.
      console.error('[GamePage] handleDragEnd a échoué :', err);
    }
  }

  function handleBlankConfirm(letter: string): void {
    if (pendingBlankDrop) {
      placement.placeLetterAt(pendingBlankDrop.row, pendingBlankDrop.col, letter, true);
    }
    setPendingBlankDrop(null);
  }

  async function handleStart(): Promise<void> {
    setActionError(null);
    setActionLoading(true);
    try {
      await start();
    } catch (err) {
      setActionError(err instanceof MoveError ? err.message : "Impossible de démarrer la partie.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSubmitMove(): Promise<void> {
    if (placement.pending.length === 0) return;
    setActionError(null);
    setActionLoading(true);
    try {
      await placeMove(placement.pending);
      placement.clear();
    } catch (err) {
      setActionError(err instanceof MoveError ? err.message : 'Coup invalide.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePass(): Promise<void> {
    setActionError(null);
    setActionLoading(true);
    try {
      await pass();
      placement.clear();
    } catch (err) {
      setActionError(err instanceof MoveError ? err.message : 'Impossible de passer.');
    } finally {
      // On ferme la confirmation dans tous les cas : en cas d'erreur, elle est affichée dans
      // le <main> (sous le fond de la modale), donc la modale doit disparaître pour la voir.
      setShowPassConfirm(false);
      setActionLoading(false);
    }
  }

  async function handleExchangeConfirm(letters: Letter[]): Promise<void> {
    setActionError(null);
    setActionLoading(true);
    try {
      await exchange(letters);
      setExchangeMode(false);
    } catch (err) {
      setActionError(err instanceof MoveError ? err.message : "Impossible d'échanger ces lettres.");
    } finally {
      setActionLoading(false);
    }
  }

  if (!gameId) return <div className="page page--centered">Partie introuvable.</div>;
  if (!connected || store.status === 'IDLE') {
    return (
      <div className="page page--centered">
        {connectionError ? <p className="form__error">{connectionError.message}</p> : <p>Connexion à la partie…</p>}
      </div>
    );
  }

  const inviteUrl = store.inviteCode ? `${window.location.origin}/g/${store.inviteCode}` : '';
  const spectateUrl = store.inviteCode ? `${window.location.origin}/watch/${store.inviteCode}` : '';

  if (store.status === 'WAITING') {
    return (
      <div className="page page--centered">
        <ConnectionBanner connected={connected} />
        <h1>Salle d'attente</h1>
        <p>Partage ce lien avec tes amis pour qu'ils rejoignent la partie :</p>
        <CopyableLink label="Lien pour rejoindre" url={inviteUrl} />
        <p>Ou pour la suivre sans y jouer (lien spectateur) :</p>
        <CopyableLink label="Lien spectateur" url={spectateUrl} />
        <PlayerList players={store.players} currentTurnIndex={-1} showRackCount={false} />
        {me?.seat === 0 ? (
          <>
            <button
              type="button"
              className="button--primary"
              disabled={store.players.length < 2 || actionLoading}
              onClick={handleStart}
            >
              Démarrer la partie
            </button>
            {store.players.length < 2 && <p className="page__hint">Il faut au moins 2 joueurs pour démarrer.</p>}
          </>
        ) : (
          <p>En attente que l'hôte démarre la partie…</p>
        )}
        {actionError && <p className="form__error">{actionError}</p>}
      </div>
    );
  }

  if (store.status === 'FINISHED') {
    const ranked = [...store.players].sort((a, b) => b.score - a.score);
    return (
      <div className="page page--centered">
        <h1>Partie terminée</h1>
        <ol className="final-scores">
          {ranked.map((p) => (
            <li key={p.gamePlayerId}>
              {p.pseudo} — {p.score} pts
            </li>
          ))}
        </ol>
        {store.board && (
          <GameBoard
            board={store.board}
            pending={[]}
            selected={null}
            direction="horizontal"
            interactive={false}
            onSelect={() => undefined}
            onRemovePending={() => undefined}
          />
        )}
        <MoveHistory entries={store.moveHistory} />
      </div>
    );
  }

  return (
    <div className="page game-page">
      <aside className="game-page__sidebar">
        <ConnectionBanner connected={connected} />
        {spectateUrl && <CopyableLink label="Lien spectateur" url={spectateUrl} />}
        <PlayerList players={store.players} currentTurnIndex={store.currentTurnIndex} showRackCount />
        {isMyTurn && <p className="game-page__turn">C'est ton tour ! <TurnTimer deadline={store.turnDeadline} /></p>}
        {!isMyTurn && <p className="game-page__turn"><TurnTimer deadline={store.turnDeadline} /></p>}
        <WordChecker />
        <h2>Derniers mots joués</h2>
        <MoveHistory entries={store.moveHistory} />
      </aside>

      <main className="game-page__main">
        <DndContext onDragEnd={handleDragEnd}>
          {store.board && (
            <GameBoard
              board={store.board}
              pending={placement.pending}
              selected={placement.selected}
              direction={placement.direction}
              interactive={canPlace}
              onSelect={placement.selectCell}
              onRemovePending={placement.removeAt}
            />
          )}

          {exchangeMode ? (
            <ExchangePanel
              rack={rackOrder}
              loading={actionLoading}
              onConfirm={handleExchangeConfirm}
              onCancel={() => setExchangeMode(false)}
            />
          ) : (
            <>
              {hideRack ? (
                <p className="rack rack--hidden">Chevalet masqué</p>
              ) : (
                <Rack
                  slots={placement.visibleRack}
                  onShuffle={() => setRackOrder(shuffleArray(rackOrder))}
                />
              )}
              {previewScore !== null && (
                <p className="game-page__score-preview">
                  Score si tu valides : <strong>{previewScore} pts</strong>
                </p>
              )}
              <div className="game-page__controls">
                <button type="button" onClick={placement.clear} disabled={placement.pending.length === 0}>
                  Rappeler
                </button>
                <button
                  type="button"
                  onClick={() => setExchangeMode(true)}
                  disabled={!canPlace || placement.pending.length > 0}
                >
                  Échanger des lettres
                </button>
                <button
                  type="button"
                  onClick={() => setShowPassConfirm(true)}
                  disabled={!canPlace || actionLoading}
                >
                  Passer
                </button>
                <button
                  type="button"
                  className="button--primary"
                  onClick={handleSubmitMove}
                  disabled={!canPlace || placement.pending.length === 0 || actionLoading}
                >
                  Valider le coup
                </button>
                <button type="button" onClick={() => setHideRack((v) => !v)}>
                  {hideRack ? 'Afficher le chevalet' : 'Cacher le chevalet'}
                </button>
              </div>
            </>
          )}
        </DndContext>

        {actionError && <p className="form__error">{actionError}</p>}
      </main>

      {pendingBlankDrop && (
        <BlankLetterModal onConfirm={handleBlankConfirm} onCancel={() => setPendingBlankDrop(null)} />
      )}

      {showPassConfirm && (
        <ConfirmModal
          title="Passer ton tour ?"
          message="Tu ne poseras aucune lettre et la main passera au joueur suivant."
          confirmLabel="Passer mon tour"
          loading={actionLoading}
          onConfirm={handlePass}
          onCancel={() => setShowPassConfirm(false)}
        />
      )}

      <TurnToast visible={showTurnToast} onDismiss={() => setShowTurnToast(false)} />
    </div>
  );
}
