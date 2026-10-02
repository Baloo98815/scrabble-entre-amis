import { randomUUID } from 'node:crypto';
import {
  InvalidMoveError,
  bonusTotal,
  normalizeWord,
  applyExchange,
  applyPass,
  applyPlaceMove,
  createEmptyBoard,
  createInitialGameState,
  type Board,
  type BonusState,
  type GameMode,
  type ProposalState,
  type BullshitUpdatePayload,
  type WordFormed,
  type DictionaryChecker,
  type GameState,
  type GameStatePayload,
  type Letter,
  type MoveAppliedPayload,
  type MoveHistoryItem,
  type MoveResult,
  type Placement,
  type PlayerPublicState,
} from '@scrabble/shared';
import { HttpError } from '../errors.js';
import {
  loadGameForRuntime,
  persistExtraWords,
  persistGameClosed,
  persistBonusClick,
  persistGameStart,
  persistMove,
  persistProposalCreated,
  persistProposalResolved,
  persistProposalVote,
  setPlayerConnected,
} from '../services/persistence.service.js';
import type { IOServer, IOSocket } from '../sockets/types.js';

export interface GamePlayerMeta {
  gamePlayerId: string;
  pseudo: string;
}

/**
 * Une partie vivante en mémoire : état de jeu, sockets connectés, file de sérialisation
 * des coups, timer de tour. Une instance par partie (WAITING ou IN_PROGRESS), gérée par
 * `GameRoomManager`.
 */
export class GameRoom {
  state: GameState;
  private readonly meta: Map<string, GamePlayerMeta>;
  private readonly sockets = new Map<string, Set<IOSocket>>(); // gamePlayerId -> sockets (multi-onglet)
  private queue: Promise<unknown> = Promise.resolve();
  private turnTimer: NodeJS.Timeout | null = null;
  private moveHistory: MoveHistoryItem[] = [];
  // --- Mode Scrabbullshit (inerte en Classic) ---
  mode: GameMode = 'CLASSIC';
  private readonly extraWords = new Set<string>();
  private bonus: BonusState | null = null;
  private proposal: ProposalState | null = null;
  /** Dictionnaire effectif de la partie : dictionnaire global + mots acceptés à l'unanimité. */
  private readonly checker: DictionaryChecker = {
    isValidWord: (word) => this.dictionary.isValidWord(word) || this.extraWords.has(normalizeWord(word)),
  };

  private constructor(
    private readonly io: IOServer,
    private readonly dictionary: DictionaryChecker,
    private readonly inviteCode: string,
    state: GameState,
    meta: GamePlayerMeta[],
  ) {
    this.state = state;
    this.meta = new Map(meta.map((m) => [m.gamePlayerId, m]));
  }

  get gameId(): string {
    return this.state.gameId;
  }

  get roomName(): string {
    return `game:${this.state.gameId}`;
  }

  static async load(io: IOServer, dictionary: DictionaryChecker, gameId: string): Promise<GameRoom> {
    const game = await loadGameForRuntime(gameId);

    const players = game.players.map((p) => ({
      gamePlayerId: p.id,
      seat: p.seat,
      rack: ((p.rack as Letter[] | null) ?? []) as Letter[],
      score: p.score,
      connected: false,
    }));
    const meta: GamePlayerMeta[] = game.players.map((p) => ({
      gamePlayerId: p.id,
      pseudo: p.user?.pseudo ?? p.guestName ?? 'Joueur',
    }));

    const state: GameState = {
      gameId: game.id,
      status: game.status === 'FINISHED' || game.status === 'ABANDONED' ? 'FINISHED' : game.status,
      board: game.status === 'WAITING' ? createEmptyBoard() : ((game.boardState as unknown as Board) ?? createEmptyBoard()),
      bag: game.status === 'WAITING' ? [] : (((game.bagState as unknown as Letter[]) ?? []) as Letter[]),
      players,
      currentTurnIndex: game.currentTurnIndex,
      consecutivePasses: game.consecutivePasses,
      turnNumber: game.turnNumber,
      turnTimeoutSeconds: game.turnTimeoutSeconds,
      turnDeadline: null,
    };

    const room = new GameRoom(io, dictionary, game.inviteCode, state, meta);
    room.mode = game.mode;
    for (const w of game.extraWords) room.extraWords.add(w);
    room.moveHistory = game.moves.map((m) => ({
      turnNumber: m.turnNumber,
      gamePlayerId: m.gamePlayerId,
      type: m.type,
      words: ((m.wordsFormed as Array<{ word: string }> | null) ?? []).map((w) => w.word),
      score: m.score,
      triggeredBy: m.triggeredBy === 'timeout' ? 'timeout' : 'player',
    }));
    if (state.status === 'IN_PROGRESS') room.armTurnTimer();
    return room;
  }

  /**
   * Tant que la partie est WAITING, de nouveaux joueurs peuvent avoir rejoint via REST
   * depuis que cette instance a été chargée/mise en cache - on rafraîchit le roster
   * depuis la DB avant de vérifier qu'un joueur en fait partie.
   */
  private async syncWaitingPlayers(): Promise<void> {
    if (this.state.status !== 'WAITING') return;
    const game = await loadGameForRuntime(this.gameId);
    // Partie clôturée via REST (WAITING → FINISHED) depuis que cette instance a été mise en cache.
    if (game.status === 'FINISHED') {
      this.state = { ...this.state, status: 'FINISHED' };
      return;
    }
    const players = game.players.map((p) => ({
      gamePlayerId: p.id,
      seat: p.seat,
      rack: [] as Letter[],
      score: p.score,
      connected: this.state.players.find((existing) => existing.gamePlayerId === p.id)?.connected ?? false,
    }));
    this.state = { ...this.state, players };
    for (const p of game.players) {
      this.meta.set(p.id, { gamePlayerId: p.id, pseudo: p.user?.pseudo ?? p.guestName ?? 'Joueur' });
    }
  }

  /** Attache un socket authentifié à la partie ; renvoie l'état personnalisé de CE joueur. */
  async attachSocket(socket: IOSocket, gamePlayerId: string): Promise<GameStatePayload> {
    await this.syncWaitingPlayers();
    if (!this.meta.has(gamePlayerId)) {
      throw new HttpError(403, 'NOT_A_PLAYER', "Vous ne faites pas partie de cette partie.");
    }
    await socket.join(this.roomName);

    const wasEmpty = !this.sockets.has(gamePlayerId) || this.sockets.get(gamePlayerId)!.size === 0;
    if (!this.sockets.has(gamePlayerId)) this.sockets.set(gamePlayerId, new Set());
    this.sockets.get(gamePlayerId)!.add(socket);

    if (wasEmpty) {
      const player = this.state.players.find((p) => p.gamePlayerId === gamePlayerId);
      if (player) player.connected = true;
      await setPlayerConnected(gamePlayerId, true).catch(() => undefined);
      socket.to(this.roomName).emit('game:playerReconnected', { gamePlayerId });
      // Prévient les sockets déjà connectés (ex: salle d'attente) du roster à jour.
      this.broadcastPersonalizedState();
    }

    return this.buildStatePayload(gamePlayerId);
  }

  /**
   * Attache un socket en lecture seule (mode spectateur) : rejoint la room pour recevoir le
   * plateau et les diffusions en direct (move:applied, game:started, game:ended), sans être
   * ajouté à `this.sockets` - donc invisible du roster de connexion des joueurs, et surtout
   * sans gamePlayerId associé côté handlers socket, ce qui bloque naturellement toute
   * tentative de move:place/exchange/pass/game:start (déjà gardés par `NOT_JOINED`).
   */
  async attachSpectator(socket: IOSocket): Promise<GameStatePayload> {
    await socket.join(this.roomName);
    // Aucun gamePlayerId réel ne correspondra jamais à cet identifiant : yourRack reste
    // vide et isYou reste false pour tout le monde, exactement ce qu'il faut pour un
    // spectateur.
    return this.buildStatePayload('__spectator__');
  }

  /** À appeler à la déconnexion d'un socket (quel que soit le joueur). */
  async detachSocket(socket: IOSocket): Promise<void> {
    for (const [gamePlayerId, sockets] of this.sockets.entries()) {
      if (!sockets.has(socket)) continue;
      sockets.delete(socket);
      if (sockets.size === 0) {
        const player = this.state.players.find((p) => p.gamePlayerId === gamePlayerId);
        if (player) player.connected = false;
        await setPlayerConnected(gamePlayerId, false).catch(() => undefined);
        this.io.to(this.roomName).emit('game:playerDisconnected', { gamePlayerId });
      }
      return;
    }
  }

  hasNoActiveSockets(): boolean {
    return [...this.sockets.values()].every((s) => s.size === 0);
  }

  async start(requesterGamePlayerId: string): Promise<GameStatePayload> {
    return this.enqueue(async () => {
      await this.syncWaitingPlayers();
      if (this.state.status !== 'WAITING') {
        throw new HttpError(409, 'GAME_ALREADY_STARTED', 'Cette partie a déjà démarré.');
      }
      const requester = this.state.players.find((p) => p.gamePlayerId === requesterGamePlayerId);
      if (!requester || requester.seat !== 0) {
        throw new HttpError(403, 'FORBIDDEN', "Seul le créateur de la partie peut la démarrer.");
      }
      if (this.state.players.length < 2) {
        throw new HttpError(400, 'NOT_ENOUGH_PLAYERS', 'Il faut au moins 2 joueurs pour démarrer.');
      }

      const playerIds = [...this.state.players].sort((a, b) => a.seat - b.seat).map((p) => p.gamePlayerId);
      this.state = createInitialGameState({
        gameId: this.gameId,
        playerIds,
        firstPlayerIndex: Math.floor(Math.random() * playerIds.length),
        turnTimeoutSeconds: this.state.turnTimeoutSeconds,
      });

      await persistGameStart(this.state);
      this.armTurnTimer();

      this.io.to(this.roomName).emit('game:started', { turnDeadline: this.state.turnDeadline });
      this.broadcastPersonalizedState();
      return this.buildStatePayload(requesterGamePlayerId);
    });
  }

  /**
   * Clôture manuelle (créateur) : stoppe le timer, passe la partie en FINISHED et prévient les
   * clients connectés via un nouvel état. Passe par la file pour ne pas croiser un coup en cours.
   */
  async close(): Promise<void> {
    await this.enqueue(async () => {
      if (this.state.status === 'FINISHED') return;
      if (this.turnTimer) {
        clearTimeout(this.turnTimer);
        this.turnTimer = null;
      }
      this.state = { ...this.state, status: 'FINISHED', turnDeadline: null };
      await persistGameClosed(this.gameId);
      this.broadcastPersonalizedState();
    });
  }

  async placeMove(gamePlayerId: string, placements: Placement[]): Promise<MoveAppliedPayload> {
    return this.enqueue(() =>
      this.applyMove(gamePlayerId, (state) => applyPlaceMove(state, placements, this.checker, 'player')),
    );
  }

  async exchange(gamePlayerId: string, letters: Letter[]): Promise<MoveAppliedPayload> {
    return this.enqueue(() => this.applyMove(gamePlayerId, (state) => applyExchange(state, letters)));
  }

  async pass(gamePlayerId: string): Promise<MoveAppliedPayload> {
    return this.enqueue(() => this.applyMove(gamePlayerId, (state) => applyPass(state, 'player')));
  }

  private async applyMove(
    gamePlayerId: string,
    run: (state: GameState) => { state: GameState; result: MoveResult },
  ): Promise<MoveAppliedPayload> {
    if (this.state.status !== 'IN_PROGRESS') {
      throw new HttpError(409, 'GAME_NOT_IN_PROGRESS', "Cette partie n'est pas en cours.");
    }
    const current = this.state.players[this.state.currentTurnIndex];
    if (!current || current.gamePlayerId !== gamePlayerId) {
      throw new HttpError(403, 'NOT_YOUR_TURN', "Ce n'est pas votre tour.");
    }

    let outcome: { state: GameState; result: MoveResult };
    try {
      outcome = run(this.state);
    } catch (err) {
      if (err instanceof InvalidMoveError) {
        throw new HttpError(400, err.code, err.message);
      }
      throw err;
    }

    this.state = outcome.state;
    await persistMove(this.state, gamePlayerId, outcome.result);
    this.moveHistory.push({
      turnNumber: outcome.result.turnNumber,
      gamePlayerId: outcome.result.gamePlayerId,
      type: outcome.result.type,
      words: outcome.result.wordsFormed?.map((w) => w.word) ?? [],
      score: outcome.result.score,
      triggeredBy: outcome.result.triggeredBy,
    });
    this.armTurnTimer();

    this.cancelProposalSilently();
    this.bonus = this.openBonus(outcome.result);
    const payload = this.buildMoveAppliedPayload(outcome.result);
    this.io.to(this.roomName).emit('move:applied', payload);
    this.sendRackUpdate(gamePlayerId);

    if (this.state.status === 'FINISHED') {
      this.io.to(this.roomName).emit('game:ended', {
        reason: this.state.bag.length === 0 ? 'emptied_rack' : 'stalemate',
        finalScores: this.state.players.map((p) => ({
          gamePlayerId: p.gamePlayerId,
          pseudo: this.meta.get(p.gamePlayerId)?.pseudo ?? 'Joueur',
          score: p.score,
        })),
      });
    }

    return payload;
  }

  // ---------------------------------------------------------------------------
  // Mode Scrabbullshit
  // ---------------------------------------------------------------------------

  private assertBullshit(): void {
    if (this.mode !== 'SCRABBULLSHIT') {
      throw new HttpError(400, 'WRONG_MODE', "Cette action n'existe qu'en mode Scrabbullshit.");
    }
    if (this.state.status !== 'IN_PROGRESS') {
      throw new HttpError(409, 'GAME_NOT_IN_PROGRESS', "Cette partie n'est pas en cours.");
    }
  }

  private assertPlayer(gamePlayerId: string): void {
    if (!this.state.players.some((p) => p.gamePlayerId === gamePlayerId)) {
      throw new HttpError(403, 'NOT_A_PLAYER', 'Les spectateurs ne peuvent pas faire cela.');
    }
  }

  /** Mot principal d'un coup : le mieux noté, à égalité le plus long. */
  private mainWord(words: WordFormed[]): string | null {
    const best = [...words].sort((a, b) => b.score - a.score || b.word.length - a.word.length)[0];
    return best?.word ?? null;
  }

  private openBonus(result: MoveResult): BonusState | null {
    if (this.mode !== 'SCRABBULLSHIT' || result.type !== 'PLACE' || !result.wordsFormed) return null;
    const word = this.mainWord(result.wordsFormed);
    if (!word) return null;
    return { turnNumber: result.turnNumber, word, authorId: result.gamePlayerId, voterIds: [] };
  }

  private cancelProposalSilently(): void {
    if (!this.proposal) return;
    const { id, word } = this.proposal;
    this.proposal = null;
    void persistProposalResolved(id, 'CANCELLED');
    this.io.to(this.roomName).emit('proposal:resolved', { id, word, outcome: 'cancelled' });
  }

  private emitBullshitUpdate(): void {
    const payload: BullshitUpdatePayload = {
      bonus: this.bonus,
      proposal: this.proposal,
      extraWords: [...this.extraWords],
      players: this.publicPlayers(null),
    };
    this.io.to(this.roomName).emit('bullshit:update', payload);
  }

  /** « +1 » sur le mot du dernier coup : 1 / 5 / 10 points au total pour l'auteur selon le nombre de clics. */
  async clickBonus(gamePlayerId: string): Promise<void> {
    await this.enqueue(async () => {
      this.assertBullshit();
      this.assertPlayer(gamePlayerId);
      const bonus = this.bonus;
      if (!bonus) throw new HttpError(409, 'NO_BONUS', "Il n'y a aucun mot à féliciter pour l'instant.");
      if (bonus.authorId === gamePlayerId) {
        throw new HttpError(403, 'OWN_WORD', 'Tu ne peux pas te féliciter toi-même.');
      }
      if (bonus.voterIds.includes(gamePlayerId)) {
        throw new HttpError(409, 'ALREADY_CLICKED', 'Tu as déjà mis un +1 sur ce mot.');
      }
      const author = this.state.players.find((p) => p.gamePlayerId === bonus.authorId);
      if (!author) throw new HttpError(409, 'NO_BONUS', "L'auteur du mot a quitté la partie.");

      const before = bonusTotal(bonus.voterIds.length);
      const after = bonusTotal(bonus.voterIds.length + 1);
      this.bonus = { ...bonus, voterIds: [...bonus.voterIds, gamePlayerId] };
      author.score += after - before;
      await persistBonusClick({
        gameId: this.gameId,
        turnNumber: bonus.turnNumber,
        word: bonus.word,
        fromPlayerId: gamePlayerId,
        toPlayerId: author.gamePlayerId,
        points: after - before,
        authorScore: author.score,
      });
      this.emitBullshitUpdate();
    });
  }

  async proposeWord(gamePlayerId: string, raw: string): Promise<void> {
    await this.enqueue(async () => {
      this.assertBullshit();
      this.assertPlayer(gamePlayerId);
      const current = this.state.players[this.state.currentTurnIndex];
      if (!current || current.gamePlayerId !== gamePlayerId) {
        throw new HttpError(403, 'NOT_YOUR_TURN', "Ce n'est pas votre tour.");
      }
      if (this.proposal) {
        throw new HttpError(409, 'PROPOSAL_PENDING', 'Une proposition est déjà en cours de vote.');
      }
      const word = normalizeWord(raw);
      if (word.length < 2 || word.length > 15) {
        throw new HttpError(400, 'INVALID_WORD', 'Le mot doit faire entre 2 et 15 lettres.');
      }
      if (this.checker.isValidWord(word)) {
        throw new HttpError(409, 'ALREADY_VALID', 'Ce mot est déjà valide, pas besoin de le proposer.');
      }
      this.proposal = { id: randomUUID(), word, proposerId: gamePlayerId, accepted: [], rejected: [] };
      await persistProposalCreated({ id: this.proposal.id, gameId: this.gameId, proposerId: gamePlayerId, word });
      this.emitBullshitUpdate();
    });
  }

  async voteWord(gamePlayerId: string, proposalId: string, accept: boolean): Promise<void> {
    await this.enqueue(async () => {
      this.assertBullshit();
      this.assertPlayer(gamePlayerId);
      const proposal = this.proposal;
      if (!proposal || proposal.id !== proposalId) {
        throw new HttpError(409, 'NO_PROPOSAL', "Cette proposition n'est plus en cours.");
      }
      if (proposal.proposerId === gamePlayerId) {
        throw new HttpError(403, 'OWN_PROPOSAL', 'Tu ne peux pas voter pour ta propre proposition.');
      }
      if (proposal.accepted.includes(gamePlayerId) || proposal.rejected.includes(gamePlayerId)) {
        throw new HttpError(409, 'ALREADY_VOTED', 'Tu as déjà voté.');
      }

      const updated: ProposalState = accept
        ? { ...proposal, accepted: [...proposal.accepted, gamePlayerId] }
        : { ...proposal, rejected: [...proposal.rejected, gamePlayerId] };

      await persistProposalVote({ proposalId: proposal.id, voterId: gamePlayerId, accept });

      const voters = this.state.players.filter((p) => p.gamePlayerId !== proposal.proposerId);
      if (updated.rejected.length > 0) {
        this.proposal = null;
        void persistProposalResolved(proposal.id, 'REJECTED');
        this.io.to(this.roomName).emit('proposal:resolved', { id: proposal.id, word: proposal.word, outcome: 'rejected' });
      } else if (voters.every((p) => updated.accepted.includes(p.gamePlayerId))) {
        this.proposal = null;
        this.extraWords.add(proposal.word);
        await persistExtraWords(this.gameId, [...this.extraWords]);
        void persistProposalResolved(proposal.id, 'ACCEPTED');
        this.io.to(this.roomName).emit('proposal:resolved', { id: proposal.id, word: proposal.word, outcome: 'accepted' });
      } else {
        this.proposal = updated;
      }
      this.emitBullshitUpdate();
    });
  }

  async cancelProposal(gamePlayerId: string): Promise<void> {
    await this.enqueue(async () => {
      this.assertBullshit();
      if (!this.proposal || this.proposal.proposerId !== gamePlayerId) {
        throw new HttpError(409, 'NO_PROPOSAL', "Tu n'as aucune proposition en cours.");
      }
      this.cancelProposalSilently();
      this.emitBullshitUpdate();
    });
  }

  private async onTurnTimeout(): Promise<void> {
    const current = this.state.players[this.state.currentTurnIndex];
    if (!current) return;
    try {
      await this.enqueue(() => this.applyMove(current.gamePlayerId, (state) => applyPass(state, 'timeout')));
    } catch {
      // Le tour a pu changer entre-temps (coup joué juste avant l'expiration) - sans effet.
    }
  }

  private armTurnTimer(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    if (this.state.status !== 'IN_PROGRESS' || this.state.turnTimeoutSeconds == null) {
      this.state.turnDeadline = null;
      return;
    }
    const delayMs = this.state.turnTimeoutSeconds * 1000;
    this.state.turnDeadline = Date.now() + delayMs;
    this.turnTimer = setTimeout(() => {
      void this.onTurnTimeout();
    }, delayMs);
  }

  private sendRackUpdate(gamePlayerId: string): void {
    const player = this.state.players.find((p) => p.gamePlayerId === gamePlayerId);
    if (!player) return;
    for (const socket of this.sockets.get(gamePlayerId) ?? []) {
      socket.emit('rack:update', { rack: player.rack });
    }
  }

  private broadcastPersonalizedState(): void {
    for (const [gamePlayerId, sockets] of this.sockets.entries()) {
      const payload = this.buildStatePayload(gamePlayerId);
      for (const socket of sockets) socket.emit('game:state', payload);
    }
  }

  private publicPlayers(viewerGamePlayerId: string | null): PlayerPublicState[] {
    return this.state.players.map((p) => ({
      gamePlayerId: p.gamePlayerId,
      pseudo: this.meta.get(p.gamePlayerId)?.pseudo ?? 'Joueur',
      seat: p.seat,
      score: p.score,
      rackCount: p.rack.length,
      connected: p.connected,
      isYou: p.gamePlayerId === viewerGamePlayerId,
    }));
  }

  private buildStatePayload(viewerGamePlayerId: string): GameStatePayload {
    const viewer = this.state.players.find((p) => p.gamePlayerId === viewerGamePlayerId);
    return {
      gameId: this.state.gameId,
      mode: this.mode,
      inviteCode: this.inviteCode,
      status: this.state.status,
      board: this.state.board,
      bagCount: this.state.bag.length,
      players: this.publicPlayers(viewerGamePlayerId),
      currentTurnIndex: this.state.currentTurnIndex,
      turnNumber: this.state.turnNumber,
      turnDeadline: this.state.turnDeadline,
      yourRack: viewer?.rack ?? [],
      moveHistory: this.moveHistory,
      bonus: this.bonus,
      proposal: this.proposal,
      extraWords: [...this.extraWords],
    };
  }

  private buildMoveAppliedPayload(result: MoveResult): MoveAppliedPayload {
    return {
      move: result,
      board: this.state.board,
      players: this.publicPlayers(null),
      nextTurnIndex: this.state.currentTurnIndex,
      bagCount: this.state.bag.length,
      turnDeadline: this.state.turnDeadline,
      gameStatus: this.state.status,
      bonus: this.bonus,
    };
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const resultPromise = this.queue.then(task);
    this.queue = resultPromise.then(
      () => undefined,
      () => undefined,
    );
    return resultPromise;
  }
}
