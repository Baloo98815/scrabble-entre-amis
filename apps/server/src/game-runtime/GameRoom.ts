import {
  InvalidMoveError,
  applyExchange,
  applyPass,
  applyPlaceMove,
  createEmptyBoard,
  createInitialGameState,
  type Board,
  type DictionaryChecker,
  type GameState,
  type GameStatePayload,
  type Letter,
  type MoveAppliedPayload,
  type MoveResult,
  type Placement,
  type PlayerPublicState,
} from '@scrabble/shared';
import { HttpError } from '../errors.js';
import { loadGameForRuntime, persistGameStart, persistMove, setPlayerConnected } from '../services/persistence.service.js';
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
    if (state.status === 'IN_PROGRESS') room.armTurnTimer();
    return room;
  }

  /**
   * Tant que la partie est WAITING, de nouveaux joueurs peuvent avoir rejoint via REST
   * depuis que cette instance a été chargée/mise en cache — on rafraîchit le roster
   * depuis la DB avant de vérifier qu'un joueur en fait partie.
   */
  private async syncWaitingPlayers(): Promise<void> {
    if (this.state.status !== 'WAITING') return;
    const game = await loadGameForRuntime(this.gameId);
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
   * ajouté à `this.sockets` — donc invisible du roster de connexion des joueurs, et surtout
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
        turnTimeoutSeconds: this.state.turnTimeoutSeconds,
      });

      await persistGameStart(this.state);
      this.armTurnTimer();

      this.io.to(this.roomName).emit('game:started', { turnDeadline: this.state.turnDeadline });
      this.broadcastPersonalizedState();
      return this.buildStatePayload(requesterGamePlayerId);
    });
  }

  async placeMove(gamePlayerId: string, placements: Placement[]): Promise<MoveAppliedPayload> {
    return this.enqueue(() =>
      this.applyMove(gamePlayerId, (state) => applyPlaceMove(state, placements, this.dictionary, 'player')),
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
    this.armTurnTimer();

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

  private async onTurnTimeout(): Promise<void> {
    const current = this.state.players[this.state.currentTurnIndex];
    if (!current) return;
    try {
      await this.enqueue(() => this.applyMove(current.gamePlayerId, (state) => applyPass(state, 'timeout')));
    } catch {
      // Le tour a pu changer entre-temps (coup joué juste avant l'expiration) — sans effet.
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
      inviteCode: this.inviteCode,
      status: this.state.status,
      board: this.state.board,
      bagCount: this.state.bag.length,
      players: this.publicPlayers(viewerGamePlayerId),
      currentTurnIndex: this.state.currentTurnIndex,
      turnNumber: this.state.turnNumber,
      turnDeadline: this.state.turnDeadline,
      yourRack: viewer?.rack ?? [],
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
