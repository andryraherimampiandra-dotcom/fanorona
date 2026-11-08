import {
  cellAt,
  directionsFrom,
  inBounds,
  opponentOf,
  opposite,
  positionsEqual,
  sameDirection,
  step,
} from "./board.js";
import type {
  ActiveChain,
  Direction,
  GameState,
  Move,
  Player,
  Position,
} from "./types.js";

/**
 * Walk from `start` in direction `d` and collect every contiguous stone belonging
 * to `color` until a non-matching cell (empty, own color, or out of bounds) stops it.
 */
function stonesAlong(
  state: GameState,
  start: Position,
  d: Direction,
  color: Player,
): Position[] {
  const stones: Position[] = [];
  let cur = start;
  while (inBounds(cur, state.variant) && cellAt(state.board, cur) === color) {
    stones.push(cur);
    cur = step(cur, d);
  }
  return stones;
}

function approachCaptures(
  state: GameState,
  from: Position,
  d: Direction,
  landing: Position,
  opponent: Player,
): Position[] {
  const beyond = step(landing, d);
  if (!inBounds(beyond, state.variant)) return [];
  if (cellAt(state.board, beyond) !== opponent) return [];
  return stonesAlong(state, beyond, d, opponent);
}

function withdrawalCaptures(
  state: GameState,
  from: Position,
  d: Direction,
  opponent: Player,
): Position[] {
  const behind = step(from, opposite(d));
  if (!inBounds(behind, state.variant)) return [];
  if (cellAt(state.board, behind) !== opponent) return [];
  return stonesAlong(state, behind, opposite(d), opponent);
}

/**
 * All single-step moves (paika + both capture modes) that `from` can make
 * in `direction`. Returns at most two moves (one approach, one withdrawal)
 * when the direction yields a capture, otherwise one paika move.
 */
function movesInDirection(
  state: GameState,
  from: Position,
  d: Direction,
): Move[] {
  const landing = step(from, d);
  if (!inBounds(landing, state.variant)) return [];
  if (cellAt(state.board, landing) !== "empty") return [];

  const me = state.toMove;
  const opp = opponentOf(me);
  const result: Move[] = [];

  const approach = approachCaptures(state, from, d, landing, opp);
  if (approach.length > 0) {
    result.push({ from, direction: d, mode: "approach", captured: approach });
  }
  const withdrawal = withdrawalCaptures(state, from, d, opp);
  if (withdrawal.length > 0) {
    result.push({ from, direction: d, mode: "withdrawal", captured: withdrawal });
  }
  if (result.length === 0) {
    result.push({ from, direction: d, mode: "paika", captured: [] });
  }
  return result;
}

function hasVisited(chain: ActiveChain, p: Position): boolean {
  return chain.visited.some((v) => positionsEqual(v, p));
}

function allowedInChain(chain: ActiveChain, m: Move): boolean {
  if (sameDirection(chain.lastDirection, m.direction)) return false;
  const landing = step(m.from, m.direction);
  if (hasVisited(chain, landing)) return false;
  return true;
}

/** Legal moves for the player to move, enforcing the mandatory-capture rule. */
export function legalMoves(state: GameState): Move[] {
  if (state.winner !== null) return [];
  if (state.chain !== null) return legalContinuations(state);

  const me = state.toMove;
  const all: Move[] = [];
  for (let r = 0; r < state.variant.rows; r++) {
    for (let c = 0; c < state.variant.cols; c++) {
      if (cellAt(state.board, { r, c }) !== me) continue;
      const from = { r, c };
      for (const d of directionsFrom(from)) {
        all.push(...movesInDirection(state, from, d));
      }
    }
  }
  const captures = all.filter((m) => m.mode !== "paika");
  return captures.length > 0 ? captures : all;
}

/**
 * Legal continuations when the current player is mid-chain. The player can also
 * decide to stop; stopping is modeled by {@link endTurn}, not by a Move.
 */
export function legalContinuations(state: GameState): Move[] {
  const chain = state.chain;
  if (chain === null) return [];
  const from = chain.at;
  const results: Move[] = [];
  for (const d of directionsFrom(from)) {
    const moves = movesInDirection(state, from, d).filter(
      (m) => m.mode !== "paika",
    );
    for (const m of moves) {
      if (allowedInChain(chain, m)) results.push(m);
    }
  }
  return results;
}

/** True if the current player has any capturing move available this turn. */
export function hasAnyCapture(state: GameState): boolean {
  return legalMoves(state).some((m) => m.mode !== "paika");
}
