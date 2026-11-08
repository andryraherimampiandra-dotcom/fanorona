import type { GameState, Move } from "@fanorona/engine";
import { evaluate, WIN_SCORE } from "./eval.js";
import { enumerateFullTurns, turnCaptureCount, type FullTurn } from "./turn.js";
import { hashKey } from "./zobrist.js";

export interface SearchOptions {
  /** Wall-clock budget in milliseconds. Iterative deepening stops when exceeded. */
  readonly timeMs?: number;
  /** Hard cap on search depth. Ignored when undefined. */
  readonly maxDepth?: number;
  /** Deterministic tiebreak seed for identical scores (0 = no shuffle). */
  readonly seed?: number;
}

export interface SearchResult {
  readonly turn: FullTurn;
  readonly score: number;
  readonly depthReached: number;
  readonly nodes: number;
  readonly elapsedMs: number;
  /** Diagnostic: how many nodes avoided a recomputation thanks to the TT. */
  readonly ttHits: number;
}

const INF = Number.POSITIVE_INFINITY;

type TTFlag = "exact" | "lower" | "upper";
interface TTEntry {
  depth: number;
  score: number;
  flag: TTFlag;
  bestKey?: string;
}

class TimeoutError extends Error {
  constructor() {
    super("search timeout");
  }
}

interface Ctx {
  readonly deadline: number;
  nodes: number;
  ttHits: number;
  readonly tt: Map<string, TTEntry>;
}

function checkDeadline(ctx: Ctx): void {
  if (ctx.nodes % 2048 === 0 && Date.now() >= ctx.deadline) {
    throw new TimeoutError();
  }
}

function turnSignature(t: FullTurn): string {
  const parts: string[] = [];
  for (const m of t.moves) {
    parts.push(`${m.from.r},${m.from.c};${m.direction.dr},${m.direction.dc};${m.mode}`);
  }
  if (t.stoppedEarly) parts.push("stop");
  return parts.join("|");
}

/** Orders captures first (bigger captures before smaller) and puts a TT best-move first when present. */
function orderTurns(turns: readonly FullTurn[], ttBestKey?: string): FullTurn[] {
  const byCaptures = [...turns].sort((a, b) => turnCaptureCount(b) - turnCaptureCount(a));
  if (!ttBestKey) return byCaptures;
  const idx = byCaptures.findIndex((t) => turnSignature(t) === ttBestKey);
  if (idx <= 0) return byCaptures;
  const [best] = byCaptures.splice(idx, 1);
  if (best) byCaptures.unshift(best);
  return byCaptures;
}

function negamax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  ctx: Ctx,
): number {
  ctx.nodes++;
  checkDeadline(ctx);

  if (state.winner !== null || depth === 0) return evaluate(state);

  const origAlpha = alpha;
  const key = hashKey(state);
  const cached = ctx.tt.get(key);
  if (cached && cached.depth >= depth) {
    if (cached.flag === "exact") {
      ctx.ttHits++;
      return cached.score;
    }
    if (cached.flag === "lower" && cached.score > alpha) alpha = cached.score;
    else if (cached.flag === "upper" && cached.score < beta) beta = cached.score;
    if (alpha >= beta) {
      ctx.ttHits++;
      return cached.score;
    }
  }

  const turns = orderTurns(enumerateFullTurns(state), cached?.bestKey);
  if (turns.length === 0) return evaluate(state);

  let best = -INF;
  let bestSig: string | undefined;
  for (const t of turns) {
    const value = -negamax(t.resulting, depth - 1, -beta, -alpha, ctx);
    if (value > best) {
      best = value;
      bestSig = turnSignature(t);
    }
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }

  const flag: TTFlag =
    best <= origAlpha ? "upper" : best >= beta ? "lower" : "exact";
  const entry: TTEntry = { depth, score: best, flag };
  if (bestSig !== undefined) entry.bestKey = bestSig;
  ctx.tt.set(key, entry);
  return best;
}

/**
 * Pick the best complete turn for the current player using negamax with
 * alpha-beta pruning, iterative deepening, and a transposition table that
 * persists across deepening iterations.
 */
export function chooseTurn(state: GameState, opts: SearchOptions = {}): SearchResult {
  const started = Date.now();
  const timeMs = opts.timeMs ?? 1000;
  const maxDepth = opts.maxDepth ?? 64;
  const deadline = started + timeMs;

  const rootTurns = enumerateFullTurns(state);
  if (rootTurns.length === 0) {
    throw new Error("No legal turns from this state.");
  }

  const ctx: Ctx = { deadline, nodes: 0, ttHits: 0, tt: new Map() };
  const orderedBase = orderTurns(rootTurns);
  let bestTurn: FullTurn = orderedBase[0]!;
  let bestScore = -INF;
  let depthReached = 0;

  for (let depth = 1; depth <= maxDepth; depth++) {
    let depthBest: FullTurn | null = null;
    let depthBestScore = -INF;
    let alpha = -INF;
    const beta = INF;

    try {
      // Put the previous iteration's best first for aggressive early cutoffs.
      const prevBestSig = turnSignature(bestTurn);
      const rootOrder = orderTurns(rootTurns, prevBestSig);

      for (const t of rootOrder) {
        const value = -negamax(t.resulting, depth - 1, -beta, -alpha, ctx);
        if (value > depthBestScore) {
          depthBestScore = value;
          depthBest = t;
        }
        if (value > alpha) alpha = value;
      }
    } catch (err) {
      if (err instanceof TimeoutError) break;
      throw err;
    }

    if (depthBest) {
      bestTurn = depthBest;
      bestScore = depthBestScore;
      depthReached = depth;
    }

    if (Math.abs(bestScore) >= WIN_SCORE - depth) break;
    if (Date.now() >= deadline) break;
  }

  return {
    turn: bestTurn,
    score: bestScore,
    depthReached,
    nodes: ctx.nodes,
    ttHits: ctx.ttHits,
    elapsedMs: Date.now() - started,
  };
}

/** Difficulty presets mapping to a time budget and a hard depth cap. */
export const DIFFICULTY: Record<"easy" | "medium" | "hard", SearchOptions> = {
  easy: { timeMs: 150, maxDepth: 2 },
  medium: { timeMs: 500, maxDepth: 4 },
  hard: { timeMs: 2000, maxDepth: 6 },
};

/** Convenience type re-exports. */
export type { FullTurn, Move };
