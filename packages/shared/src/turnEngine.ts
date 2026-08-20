import type { GameState, Letter, MoveResult, Placement, PlayerState, TileOnBoard } from './types.js';
import { createEmptyBoard, placeTiles } from './board.js';
import { validatePlacement, InvalidMoveError } from './placement.js';
import { extractWordsFormed } from './wordExtraction.js';
import { scoreMove, scoreWord } from './scoring.js';
import type { DictionaryChecker } from './dictionaryValidator.js';
import { hasLetters, removeFromRack, addToRack } from './rack.js';
import { createInitialBag, drawLetters, refillRack, shuffle, RACK_SIZE, MIN_EXCHANGE_BAG_SIZE } from './letterBag.js';
import { isGameOver, applyEndOfGameAdjustments } from './endgame.js';

export { InvalidMoveError };

export interface CreateInitialGameStateParams {
  gameId: string;
  /** gamePlayerId de chaque joueur, dans l'ordre des sièges (l'ordre de jeu). */
  playerIds: string[];
  turnTimeoutSeconds?: number | null;
  rng?: () => number;
}

/** Construit l'état initial d'une partie : plateau vide, sac mélangé, chevalets distribués. */
export function createInitialGameState(params: CreateInitialGameStateParams): GameState {
  const rng = params.rng ?? Math.random;
  let bag = createInitialBag(rng);

  const players: PlayerState[] = params.playerIds.map((gamePlayerId, seat) => {
    const { rack, bag: remaining } = refillRack(bag, [], RACK_SIZE);
    bag = remaining;
    return { gamePlayerId, seat, rack, score: 0, connected: true };
  });

  return {
    gameId: params.gameId,
    status: 'IN_PROGRESS',
    board: createEmptyBoard(),
    bag,
    players,
    currentTurnIndex: 0,
    consecutivePasses: 0,
    turnNumber: 0,
    turnTimeoutSeconds: params.turnTimeoutSeconds ?? null,
    turnDeadline: null,
  };
}

function currentPlayer(state: GameState): PlayerState {
  const player = state.players[state.currentTurnIndex];
  if (!player) throw new Error('Aucun joueur au tour courant.');
  return player;
}

function isBoardEmpty(state: GameState): boolean {
  return state.board.cells.every((row) => row.every((cell) => cell === null));
}

function advanceTurn(state: GameState): GameState {
  const nextIndex = (state.currentTurnIndex + 1) % state.players.length;
  return { ...state, currentTurnIndex: nextIndex, turnNumber: state.turnNumber + 1 };
}

function finalizeIfEnded(state: GameState): GameState {
  return isGameOver(state) ? applyEndOfGameAdjustments(state) : state;
}

/** Pose un mot sur le plateau : valide le placement, le dictionnaire, calcule le score. */
export function applyPlaceMove(
  state: GameState,
  placements: Placement[],
  dictionary: DictionaryChecker,
  triggeredBy: 'player' | 'timeout' = 'player',
): { state: GameState; result: MoveResult } {
  const player = currentPlayer(state);
  const isFirstMove = isBoardEmpty(state);

  validatePlacement(state.board, placements, isFirstMove);

  const requiredFromRack: Letter[] = placements.map((p) => (p.isBlank ? '*' : p.letter));
  if (!hasLetters(player.rack, requiredFromRack)) {
    throw new InvalidMoveError('RACK_MISMATCH', 'Les lettres posées ne sont pas dans le chevalet.');
  }

  const words = extractWordsFormed(state.board, placements);
  if (words.length === 0) {
    throw new InvalidMoveError('NO_WORD_FORMED', 'Aucun mot formé par ce coup.');
  }
  for (const word of words) {
    if (!dictionary.isValidWord(word.word)) {
      throw new InvalidMoveError('INVALID_WORD', `Mot invalide: ${word.word}`);
    }
  }

  const newTiles: Array<{ row: number; col: number; tile: TileOnBoard }> = placements.map((p) => ({
    row: p.row,
    col: p.col,
    tile: { letter: p.letter, isBlank: p.isBlank, playedBy: player.gamePlayerId, turnNumber: state.turnNumber },
  }));
  const board = placeTiles(state.board, newTiles);

  const score = scoreMove(words, placements.length);
  const rackAfterRemoval = removeFromRack(player.rack, requiredFromRack);
  const { rack, bag } = refillRack(state.bag, rackAfterRemoval, RACK_SIZE);

  const players = state.players.map((p) =>
    p.gamePlayerId === player.gamePlayerId ? { ...p, rack, score: p.score + score } : p,
  );

  let nextState: GameState = { ...state, board, bag, players, consecutivePasses: 0 };
  nextState = advanceTurn(nextState);

  const result: MoveResult = {
    type: 'PLACE',
    gamePlayerId: player.gamePlayerId,
    turnNumber: state.turnNumber,
    tilesPlaced: placements,
    wordsFormed: words.map((w) => ({
      word: w.word,
      score: scoreWord(w),
      cells: w.cells.map(({ row, col }) => ({ row, col })),
    })),
    score,
    triggeredBy,
  };

  return { state: finalizeIfEnded(nextState), result };
}

/** Échange des lettres du chevalet contre de nouvelles piochées dans le sac (tour perdu). */
export function applyExchange(
  state: GameState,
  letters: Letter[],
): { state: GameState; result: MoveResult } {
  const player = currentPlayer(state);

  if (letters.length === 0) {
    throw new InvalidMoveError('EMPTY_EXCHANGE', 'Aucune lettre à échanger.');
  }
  if (state.bag.length < MIN_EXCHANGE_BAG_SIZE) {
    throw new InvalidMoveError(
      'BAG_TOO_SMALL',
      "Impossible d'échanger : il reste moins de 7 lettres dans le sac.",
    );
  }
  if (!hasLetters(player.rack, letters)) {
    throw new InvalidMoveError('RACK_MISMATCH', 'Lettres à échanger absentes du chevalet.');
  }

  const rackAfterRemoval = removeFromRack(player.rack, letters);
  const { drawn, remaining } = drawLetters(state.bag, letters.length);
  const rack = addToRack(rackAfterRemoval, drawn);
  // Les lettres échangées ne sont remises dans le sac qu'après la pioche, pour ne pas
  // pouvoir les repiocher immédiatement, puis le sac est remélangé.
  const bag = shuffle([...remaining, ...letters]);

  const players = state.players.map((p) => (p.gamePlayerId === player.gamePlayerId ? { ...p, rack } : p));

  let nextState: GameState = { ...state, bag, players, consecutivePasses: state.consecutivePasses + 1 };
  nextState = advanceTurn(nextState);

  const result: MoveResult = {
    type: 'EXCHANGE',
    gamePlayerId: player.gamePlayerId,
    turnNumber: state.turnNumber,
    tilesPlaced: null,
    wordsFormed: null,
    score: 0,
    triggeredBy: 'player',
  };

  return { state: finalizeIfEnded(nextState), result };
}

/** Passe le tour sans jouer (déclenché par le joueur ou automatiquement par timeout). */
export function applyPass(
  state: GameState,
  triggeredBy: 'player' | 'timeout' = 'player',
): { state: GameState; result: MoveResult } {
  const player = currentPlayer(state);

  let nextState: GameState = { ...state, consecutivePasses: state.consecutivePasses + 1 };
  nextState = advanceTurn(nextState);

  const result: MoveResult = {
    type: 'PASS',
    gamePlayerId: player.gamePlayerId,
    turnNumber: state.turnNumber,
    tilesPlaced: null,
    wordsFormed: null,
    score: 0,
    triggeredBy,
  };

  return { state: finalizeIfEnded(nextState), result };
}
