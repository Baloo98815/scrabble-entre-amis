import { getBonus, type Placement, type WordFormed } from '@scrabble/shared';

/** Une place de joueur dans une partie (ligne `GamePlayer` aplatie). */
export interface StatsSeat {
  id: string;
  gameId: string;
  userId: string | null;
  guestId: string | null;
  pseudo: string;
  score: number;
}

export interface StatsGame {
  id: string;
  status: 'WAITING' | 'IN_PROGRESS' | 'FINISHED' | 'ABANDONED';
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface StatsMove {
  gameId: string;
  gamePlayerId: string;
  turnNumber: number;
  type: 'PLACE' | 'EXCHANGE' | 'PASS';
  score: number;
  isBingo: boolean;
  tilesPlaced: Placement[] | null;
  wordsFormed: WordFormed[] | null;
  triggeredBy: string;
  createdAt: Date;
}

export interface StatsBonusClick {
  gameId: string;
  turnNumber: number;
  word: string;
  fromPlayerId: string;
  toPlayerId: string;
  points: number;
}

export interface StatsProposal {
  proposerId: string;
  outcome: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
}

export interface StatsVote {
  voterId: string;
  accept: boolean;
}

export interface StatsInput {
  userId: string;
  /** Toutes les places des parties du joueur (les siennes et celles des adversaires). */
  seats: StatsSeat[];
  games: StatsGame[];
  moves: StatsMove[];
  bonusClicks: StatsBonusClick[];
  proposals: StatsProposal[];
  votes: StatsVote[];
}

export interface HeadToHead {
  opponent: { pseudo: string; userId: string | null };
  games: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface PlayerStats {
  games: {
    /** Parties démarrées (en cours ou terminées) ; la salle d'attente ne compte pas. */
    played: number;
    finished: number;
    /** Meilleur score de la partie (égalité comprise). */
    won: number;
    winRate: number | null;
    currentWinStreak: number;
    bestWinStreak: number;
  };
  scores: {
    averageGameScore: number | null;
    bestGameScore: number | null;
    averageMoveScore: number | null;
    bestMove: { score: number; word: string | null } | null;
  };
  play: {
    bingos: number;
    passes: number;
    timeoutPasses: number;
    exchanges: number;
    blanksPlayed: number;
    wordsFormed: number;
  };
  words: {
    longest: string | null;
    bestScoring: { word: string; score: number } | null;
    mostPlayed: Array<{ word: string; count: number }>;
    rareLetters: Record<'Q' | 'Z' | 'K' | 'W' | 'X', number>;
  };
  premiums: { tripleWord: number; doubleWord: number; multiPremiumMoves: number };
  scrabbullshit: {
    bonusGiven: number;
    bonusReceived: number;
    bonusPointsReceived: number;
    /** +1 donnés / +1 reçus (null tant qu'il n'en a reçu aucun). */
    generosityRatio: number | null;
    mostApplaudedWord: { word: string; clicks: number } | null;
    proposalsMade: number;
    proposalsAccepted: number;
    proposalsRejected: number;
    acceptanceRate: number | null;
    votesCast: number;
    votesAccepted: number;
    votesRejected: number;
  };
  headToHead: HeadToHead[];
  pace: {
    /** Délai médian entre le coup précédent et le sien, coups joués par le joueur (hors timeout). */
    medianThinkSeconds: number | null;
  };
  comeback: {
    /** Plus gros retard sur le meneur rattrapé avant de gagner (scores des coups seulement, hors +1). */
    biggestDeficitOvercome: number;
  };
}

const RARE = ['Q', 'Z', 'K', 'W', 'X'] as const;

function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function average(values: number[]): number | null {
  return values.length === 0 ? null : round(values.reduce((a, b) => a + b, 0) / values.length);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] as number) : round(((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2);
}

/** Calcule toutes les statistiques d'un joueur à partir des événements enregistrés (fonction pure). */
export function computeStats(input: StatsInput): PlayerStats {
  const mySeats = input.seats.filter((s) => s.userId === input.userId);
  const myIds = new Set(mySeats.map((s) => s.id));
  const gameById = new Map(input.games.map((g) => [g.id, g]));

  // ---- Parties ---------------------------------------------------------------------------
  const started = mySeats.filter((s) => {
    const status = gameById.get(s.gameId)?.status;
    return status === 'IN_PROGRESS' || status === 'FINISHED';
  });
  const finished = mySeats
    .filter((s) => gameById.get(s.gameId)?.status === 'FINISHED')
    .sort((a, b) => {
      const ga = gameById.get(a.gameId);
      const gb = gameById.get(b.gameId);
      const ta = (ga?.finishedAt ?? ga?.startedAt)?.getTime() ?? 0;
      const tb = (gb?.finishedAt ?? gb?.startedAt)?.getTime() ?? 0;
      return ta - tb;
    });

  const rivalsOf = (seat: StatsSeat) => input.seats.filter((s) => s.gameId === seat.gameId && s.id !== seat.id);
  const results = finished.map((seat) => {
    const best = Math.max(seat.score, ...rivalsOf(seat).map((r) => r.score));
    return { seat, won: seat.score >= best };
  });

  let bestStreak = 0;
  let streak = 0;
  for (const r of results) {
    streak = r.won ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
  }

  // ---- Coups -----------------------------------------------------------------------------
  const myMoves = input.moves.filter((m) => myIds.has(m.gamePlayerId));
  const placeMoves = myMoves.filter((m) => m.type === 'PLACE');

  let bestMove: PlayerStats['scores']['bestMove'] = null;
  for (const m of placeMoves) {
    if (!bestMove || m.score > bestMove.score) {
      const main = [...(m.wordsFormed ?? [])].sort((a, b) => b.score - a.score)[0];
      bestMove = { score: m.score, word: main?.word ?? null };
    }
  }

  const wordCounts = new Map<string, number>();
  let longest: string | null = null;
  let bestScoring: PlayerStats['words']['bestScoring'] = null;
  let wordsFormed = 0;
  const rareLetters = { Q: 0, Z: 0, K: 0, W: 0, X: 0 };
  let blanksPlayed = 0;
  let tripleWord = 0;
  let doubleWord = 0;
  let multiPremiumMoves = 0;

  for (const m of placeMoves) {
    for (const w of m.wordsFormed ?? []) {
      wordsFormed += 1;
      wordCounts.set(w.word, (wordCounts.get(w.word) ?? 0) + 1);
      if (!longest || w.word.length > longest.length) longest = w.word;
      if (!bestScoring || w.score > bestScoring.score) bestScoring = { word: w.word, score: w.score };
    }
    let premiumsInMove = 0;
    for (const p of m.tilesPlaced ?? []) {
      if (p.isBlank) blanksPlayed += 1;
      else if ((RARE as readonly string[]).includes(p.letter)) rareLetters[p.letter as (typeof RARE)[number]] += 1;
      const type = getBonus(p.row, p.col).type;
      if (type) premiumsInMove += 1;
      if (type === 'TW') tripleWord += 1;
      if (type === 'DW') doubleWord += 1;
    }
    if (premiumsInMove >= 2) multiPremiumMoves += 1;
  }

  // ---- Scrabbullshit ---------------------------------------------------------------------
  const received = input.bonusClicks.filter((c) => myIds.has(c.toPlayerId));
  const given = input.bonusClicks.filter((c) => myIds.has(c.fromPlayerId));
  const clicksPerMove = new Map<string, { word: string; clicks: number }>();
  for (const c of received) {
    const key = `${c.gameId}:${c.turnNumber}`;
    const entry = clicksPerMove.get(key) ?? { word: c.word, clicks: 0 };
    entry.clicks += 1;
    clicksPerMove.set(key, entry);
  }
  const mostApplaudedWord = [...clicksPerMove.values()].sort((a, b) => b.clicks - a.clicks)[0] ?? null;

  const myProposals = input.proposals.filter((p) => myIds.has(p.proposerId) && p.outcome !== 'PENDING');
  const proposalsAccepted = myProposals.filter((p) => p.outcome === 'ACCEPTED').length;
  const proposalsRejected = myProposals.filter((p) => p.outcome === 'REJECTED').length;
  const myVotes = input.votes.filter((v) => myIds.has(v.voterId));

  // ---- Face-à-face -----------------------------------------------------------------------
  const duels = new Map<string, HeadToHead>();
  for (const seat of finished) {
    for (const rival of rivalsOf(seat)) {
      const key = rival.userId ? `u:${rival.userId}` : rival.guestId ? `g:${rival.guestId}` : `n:${rival.pseudo}`;
      const duel =
        duels.get(key) ??
        { opponent: { pseudo: rival.pseudo, userId: rival.userId }, games: 0, wins: 0, losses: 0, draws: 0 };
      duel.games += 1;
      if (seat.score > rival.score) duel.wins += 1;
      else if (seat.score < rival.score) duel.losses += 1;
      else duel.draws += 1;
      duels.set(key, duel);
    }
  }

  // ---- Rythme ----------------------------------------------------------------------------
  const thinkSeconds: number[] = [];
  const movesByGame = new Map<string, StatsMove[]>();
  for (const m of input.moves) movesByGame.set(m.gameId, [...(movesByGame.get(m.gameId) ?? []), m]);
  for (const [gameId, moves] of movesByGame) {
    const ordered = [...moves].sort((a, b) => a.turnNumber - b.turnNumber);
    let previous = gameById.get(gameId)?.startedAt ?? null;
    for (const m of ordered) {
      if (previous && myIds.has(m.gamePlayerId) && m.triggeredBy === 'player') {
        const seconds = (m.createdAt.getTime() - previous.getTime()) / 1000;
        if (seconds > 0) thinkSeconds.push(seconds);
      }
      previous = m.createdAt;
    }
  }

  // ---- Remontées -------------------------------------------------------------------------
  let biggestDeficit = 0;
  for (const { seat, won } of results) {
    if (!won) continue;
    const cumulative = new Map<string, number>(input.seats.filter((s) => s.gameId === seat.gameId).map((s) => [s.id, 0]));
    for (const m of (movesByGame.get(seat.gameId) ?? []).sort((a, b) => a.turnNumber - b.turnNumber)) {
      cumulative.set(m.gamePlayerId, (cumulative.get(m.gamePlayerId) ?? 0) + m.score);
      const mine = cumulative.get(seat.id) ?? 0;
      const leader = Math.max(...[...cumulative.entries()].filter(([id]) => id !== seat.id).map(([, v]) => v));
      biggestDeficit = Math.max(biggestDeficit, leader - mine);
    }
  }

  const wins = results.filter((r) => r.won).length;
  return {
    games: {
      played: started.length,
      finished: finished.length,
      won: wins,
      winRate: finished.length ? round(wins / finished.length, 3) : null,
      currentWinStreak: streak,
      bestWinStreak: bestStreak,
    },
    scores: {
      averageGameScore: average(finished.map((s) => s.score)),
      bestGameScore: finished.length ? Math.max(...finished.map((s) => s.score)) : null,
      averageMoveScore: average(placeMoves.map((m) => m.score)),
      bestMove,
    },
    play: {
      bingos: placeMoves.filter((m) => m.isBingo).length,
      passes: myMoves.filter((m) => m.type === 'PASS' && m.triggeredBy !== 'timeout').length,
      timeoutPasses: myMoves.filter((m) => m.type === 'PASS' && m.triggeredBy === 'timeout').length,
      exchanges: myMoves.filter((m) => m.type === 'EXCHANGE').length,
      blanksPlayed,
      wordsFormed,
    },
    words: {
      longest,
      bestScoring,
      mostPlayed: [...wordCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 5)
        .map(([word, count]) => ({ word, count })),
      rareLetters,
    },
    premiums: { tripleWord, doubleWord, multiPremiumMoves },
    scrabbullshit: {
      bonusGiven: given.length,
      bonusReceived: received.length,
      bonusPointsReceived: received.reduce((n, c) => n + c.points, 0),
      generosityRatio: received.length ? round(given.length / received.length, 2) : null,
      mostApplaudedWord,
      proposalsMade: myProposals.length,
      proposalsAccepted,
      proposalsRejected,
      acceptanceRate: proposalsAccepted + proposalsRejected ? round(proposalsAccepted / (proposalsAccepted + proposalsRejected), 3) : null,
      votesCast: myVotes.length,
      votesAccepted: myVotes.filter((v) => v.accept).length,
      votesRejected: myVotes.filter((v) => !v.accept).length,
    },
    headToHead: [...duels.values()].sort((a, b) => b.games - a.games),
    pace: { medianThinkSeconds: median(thinkSeconds) },
    comeback: { biggestDeficitOvercome: biggestDeficit },
  };
}
