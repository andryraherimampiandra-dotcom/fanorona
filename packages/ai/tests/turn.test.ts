import { describe, expect, it } from "vitest";
import {
  VARIANTS,
  emptyBoard,
  newGame,
  setCell,
  type Cell,
  type GameState,
} from "@fanorona/engine";
import { enumerateFullTurns, turnCaptureCount } from "../src/turn.js";

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

describe("enumerateFullTurns", () => {
  it("returns at least one turn from the Tsivy opening", () => {
    const s = newGame("tsivy");
    const turns = enumerateFullTurns(s);
    expect(turns.length).toBeGreaterThan(0);
    // All opening turns must capture at least one stone.
    for (const t of turns) expect(turnCaptureCount(t)).toBeGreaterThan(0);
  });

  it("enumerates all stopping points of a chain", () => {
    // Line: W . B . B — white at (2,2) east captures (2,4), then from (2,3) south
    // can also capture (3,3)+(4,3) if we add that column.
    const s = stateWith("tsivy", [
      [2, 2, "white"],
      [2, 4, "black"],
      [3, 3, "black"],
      [4, 3, "black"],
    ]);
    const turns = enumerateFullTurns(s);
    // Must include at least the single-capture turn and a two-capture extension.
    const captureCounts = turns.map(turnCaptureCount).sort((a, b) => a - b);
    expect(captureCounts[0]).toBe(1);
    expect(captureCounts[captureCounts.length - 1]).toBeGreaterThanOrEqual(2);
  });

  it("marks voluntary stops with stoppedEarly", () => {
    const s = stateWith("tsivy", [
      [2, 2, "white"],
      [2, 4, "black"],
      [3, 3, "black"],
      [4, 3, "black"],
    ]);
    const turns = enumerateFullTurns(s);
    expect(turns.some((t) => t.stoppedEarly)).toBe(true);
    expect(turns.some((t) => !t.stoppedEarly)).toBe(true);
  });

  it("every enumerated turn's resulting state has passed the turn", () => {
    const s = newGame("tsivy");
    for (const t of enumerateFullTurns(s)) {
      expect(t.resulting.chain).toBeNull();
      // Either the opponent is to move or the game ended on this turn.
      if (t.resulting.winner === null) {
        expect(t.resulting.toMove).toBe("black");
      }
    }
  });
});
