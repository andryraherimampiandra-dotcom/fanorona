import {
  cellAt,
  countStones,
  opponentOf,
  positionsEqual,
  setCell,
  startingBoard,
  step,
  VARIANTS,
} from "./board.js";
import { hasAnyCapture, legalContinuations, legalMoves } from "./moves.js";
import type {
  ActiveChain,
  Cell,
  GameState,
  Move,
  Variant,
  VariantId,
} from "./types.js";

/** Soft-draw threshold: this many consecutive paika half-moves ends the game as draw. */
const PAIKA_DRAW_LIMIT = 40;

export function newGame(variantId: VariantId = "tsivy"): GameState {
  const variant = VARIANTS[variantId];
  return {
    variant,
    board: startingBoard(variant),
    toMove: "white",
    chain: null,
    paikaStreak: 0,
    winner: null,
  };
}

function moveEquals(a: Move, b: Move): boolean {
  return (
    positionsEqual(a.from, b.from) &&
    a.direction.dr === b.direction.dr &&
    a.direction.dc === b.direction.dc &&
    a.mode === b.mode
  );
}

/** Resolve the winner (or draw) for the given state. Call after applying a half-move. */
function detectEnd(state: GameState): GameState {
  const whiteStones = countStones(state.board, "white");
  const blackStones = countStones(state.board, "black");
  if (whiteStones === 0 && blackStones === 0) return { ...state, winner: "draw" };
  if (whiteStones === 0) return { ...state, winner: "black" };
  if (blackStones === 0) return { ...state, winner: "white" };
  if (state.paikaStreak >= PAIKA_DRAW_LIMIT) return { ...state, winner: "draw" };
  // If the next player has no legal moves at all, they lose.
  if (state.chain === null && legalMoves(state).length === 0) {
    return { ...state, winner: opponentOf(state.toMove) };
  }
  return state;
}

/**
 * Apply a single move. If the move is a capture, the state is returned with
 * `chain` set so the caller can offer continuations or call {@link endTurn}.
 * If the move is paika or the chain cannot continue, the turn passes.
 */
export function applyMove(state: GameState, move: Move): GameState {
  if (state.winner !== null) {
    throw new Error("Game is over; no moves can be applied.");
  }
  const legal = state.chain ? legalContinuations(state) : legalMoves(state);
  const match = legal.find((m) => moveEquals(m, move));
  if (!match) throw new Error("Illegal move.");

  const landing = step(match.from, match.direction);
  let board: Cell[][] = state.board.map((row) => row.slice());
  board = setCell(board, match.from, "empty");
  board = setCell(board, landing, state.toMove);
  for (const p of match.captured) board = setCell(board, p, "empty");

  const isCapture = match.mode !== "paika";
  const paikaStreak = isCapture ? 0 : state.paikaStreak + 1;

  if (!isCapture) {
    // Paika ends the turn immediately.
    const after: GameState = {
      ...state,
      board,
      toMove: opponentOf(state.toMove),
      chain: null,
      paikaStreak,
    };
    return detectEnd(after);
  }

  const visited: readonly { r: number; c: number }[] = state.chain
    ? [...state.chain.visited, landing]
    : [match.from, landing];
  const nextChain: ActiveChain = {
    at: landing,
    visited,
    lastDirection: match.direction,
  };
  const probe: GameState = {
    ...state,
    board,
    chain: nextChain,
    paikaStreak,
  };
  // If no legal continuation exists, the chain must end automatically.
  const continuations = legalContinuations(probe);
  if (continuations.length === 0) {
    const after: GameState = {
      ...probe,
      toMove: opponentOf(state.toMove),
      chain: null,
    };
    return detectEnd(after);
  }
  return detectEnd(probe);
}

/** End the current chain voluntarily, passing the turn. No-op if not in a chain. */
export function endTurn(state: GameState): GameState {
  if (state.winner !== null || state.chain === null) return state;
  const after: GameState = {
    ...state,
    toMove: opponentOf(state.toMove),
    chain: null,
  };
  return detectEnd(after);
}

/** Convenience accessor for UIs. */
export function pieceAt(state: GameState, r: number, c: number): Cell {
  return cellAt(state.board, { r, c }) ?? "empty";
}

export function hasCaptureAvailable(state: GameState): boolean {
  return hasAnyCapture(state);
}

export type { Variant } from "./types.js";
