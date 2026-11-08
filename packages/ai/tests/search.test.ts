import { describe, expect, it } from "vitest";
import {
  VARIANTS,
  emptyBoard,
  newGame,
  setCell,
  type Cell,
  type GameState,
} from "@fanorona/engine";
import { DIFFICULTY, chooseTurn } from "../src/search.js";
import { turnCaptureCount } from "../src/turn.js";
import { WIN_SCORE } from "../src/eval.js";

function stateWith(
  variantId: "telo" | "dimy" | "tsivy",
  stones: readonly (readonly [number, number, Cell])[],
  toMove: "white" | "black" = "white",
): GameState {
  const variant = VARIANTS[variantId];
  let board = emptyBoard(variant);
  for (const [r, c, v] of stones) board = setCell(board, { r, c }, v);
  return {
    variant,
    board,
    toMove,
    chain: null,
    paikaStreak: 0,
    winner: null,
  };
}

describe("chooseTurn", () => {
  it("returns a legal turn from the opening", () => {
    const s = newGame("tsivy");
    const result = chooseTurn(s, DIFFICULTY.easy);
    expect(result.turn.moves.length).toBeGreaterThan(0);
    expect(result.depthReached).toBeGreaterThanOrEqual(1);
  });

  it("finds the immediate-winning capture", () => {
    // Black has one stone; white can capture it in one hop.
    const s = stateWith("tsivy", [
      [2, 2, "white"],
      [2, 4, "black"],
    ]);
    const result = chooseTurn(s, DIFFICULTY.easy);
    expect(result.turn.resulting.winner).toBe("white");
    expect(result.score).toBeGreaterThan(WIN_SCORE / 2);
  });

  it("prefers the longer chain when it wins more material", () => {
    // Column 3 has three black stones; white at (2,2) can:
    //   - stop after 1 capture (2,4), or
    //   - chain to capture (3,3)+(4,3) for 3 total.
    const s = stateWith("tsivy", [
      [2, 2, "white"],
      [2, 4, "black"],
      [3, 3, "black"],
      [4, 3, "black"],
    ]);
    const result = chooseTurn(s, DIFFICULTY.medium);
    expect(turnCaptureCount(result.turn)).toBeGreaterThanOrEqual(2);
  });

  it("respects the time budget", () => {
    const s = newGame("tsivy");
    const started = Date.now();
    const result = chooseTurn(s, { timeMs: 200, maxDepth: 64 });
    const elapsed = Date.now() - started;
    // Allow generous slack over the budget for the final root sweep + JIT warmup.
    expect(elapsed).toBeLessThan(1500);
    expect(result.turn.moves.length).toBeGreaterThan(0);
  });

  it("is deterministic given the same input and budget", () => {
    const s = newGame("dimy");
    const a = chooseTurn(s, { timeMs: 300, maxDepth: 3 });
    const b = chooseTurn(s, { timeMs: 300, maxDepth: 3 });
    expect(a.turn.moves.length).toBe(b.turn.moves.length);
    for (let i = 0; i < a.turn.moves.length; i++) {
      expect(a.turn.moves[i]!.from).toEqual(b.turn.moves[i]!.from);
      expect(a.turn.moves[i]!.direction).toEqual(b.turn.moves[i]!.direction);
      expect(a.turn.moves[i]!.mode).toBe(b.turn.moves[i]!.mode);
    }
  });
});
