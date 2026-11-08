import { describe, expect, it } from "vitest";
import {
  VARIANTS,
  emptyBoard,
  newGame,
  setCell,
  type Cell,
  type GameState,
} from "@fanorona/engine";
import { WIN_SCORE, evaluate } from "../src/eval.js";

function stateWith(
  variantId: "telo" | "dimy" | "tsivy",
  stones: readonly (readonly [number, number, Cell])[],
  toMove: "white" | "black" = "white",
  winner: GameState["winner"] = null,
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
    winner,
  };
}

describe("evaluate", () => {
  it("returns 0 on the symmetric opening", () => {
    const s = newGame("tsivy");
    // The starting position is materially symmetric, so eval should be near 0.
    // (Minor noise from mobility/center is possible but must be small.)
    expect(Math.abs(evaluate(s))).toBeLessThan(50);
  });

  it("returns +WIN_SCORE when the current player has already won", () => {
    const s = stateWith("tsivy", [[0, 0, "white"]], "white", "white");
    expect(evaluate(s)).toBe(WIN_SCORE);
  });

  it("returns -WIN_SCORE when the current player has already lost", () => {
    const s = stateWith("tsivy", [[0, 0, "white"]], "black", "white");
    expect(evaluate(s)).toBe(-WIN_SCORE);
  });

  it("is positive when the player to move has a material edge", () => {
    const s = stateWith("tsivy", [
      [0, 0, "white"],
      [0, 2, "white"],
      [4, 8, "black"],
    ]);
    expect(evaluate(s)).toBeGreaterThan(0);
  });

  it("is symmetric under color swap", () => {
    const a = stateWith(
      "tsivy",
      [
        [0, 0, "white"],
        [0, 2, "white"],
        [4, 8, "black"],
      ],
      "white",
    );
    const b = stateWith(
      "tsivy",
      [
        [0, 0, "black"],
        [0, 2, "black"],
        [4, 8, "white"],
      ],
      "black",
    );
    expect(evaluate(a)).toBe(evaluate(b));
  });
});
