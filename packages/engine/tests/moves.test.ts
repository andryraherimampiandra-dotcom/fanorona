import { describe, expect, it } from "vitest";
import { emptyBoard, setCell, VARIANTS } from "../src/board.js";
import { hasAnyCapture, legalMoves } from "../src/moves.js";
import type { Cell, GameState } from "../src/types.js";
import { newGame } from "../src/game.js";

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

describe("mandatory capture", () => {
  it("Tsivy opening has captures and no paika is listed", () => {
    const s = newGame("tsivy");
    const moves = legalMoves(s);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => m.mode !== "paika")).toBe(true);
    expect(hasAnyCapture(s)).toBe(true);
  });

  it("returns paika moves only when no capture exists", () => {
    // One white and one black on far ends with nothing to capture.
    const s = stateWith("tsivy", [
      [0, 0, "white"],
      [4, 8, "black"],
    ]);
    const moves = legalMoves(s);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => m.mode === "paika")).toBe(true);
  });
});

describe("approach capture (percussion)", () => {
  it("captures contiguous enemy stones in the direction of motion", () => {
    // White at (2,2) moves east to (2,3); beyond are two blacks then a stop.
    const s = stateWith("tsivy", [
      [2, 2, "white"],
      [2, 4, "black"],
      [2, 5, "black"],
      [2, 6, "white"], // breaks the line
    ]);
    const approaches = legalMoves(s).filter(
      (m) =>
        m.from.r === 2 &&
        m.from.c === 2 &&
        m.direction.dr === 0 &&
        m.direction.dc === 1 &&
        m.mode === "approach",
    );
    expect(approaches).toHaveLength(1);
    expect(approaches[0]!.captured).toEqual([
      { r: 2, c: 4 },
      { r: 2, c: 5 },
    ]);
  });
});

describe("withdrawal capture (aspiration)", () => {
  it("captures contiguous enemy stones in the opposite direction", () => {
    // White at (2,4) moves east to (2,5); behind (opposite = west) is black at (2,3), (2,2).
    const s = stateWith("tsivy", [
      [2, 4, "white"],
      [2, 3, "black"],
      [2, 2, "black"],
      [2, 1, "white"], // breaks the line
    ]);
    const withdrawals = legalMoves(s).filter(
      (m) =>
        m.from.r === 2 &&
        m.from.c === 4 &&
        m.direction.dr === 0 &&
        m.direction.dc === 1 &&
        m.mode === "withdrawal",
    );
    expect(withdrawals).toHaveLength(1);
    expect(withdrawals[0]!.captured).toEqual([
      { r: 2, c: 3 },
      { r: 2, c: 2 },
    ]);
  });
});

describe("choice when both apply", () => {
  it("exposes approach AND withdrawal as separate legal moves", () => {
    // Line: BLACK (2,2) WHITE (2,3) EMPTY (2,4) BLACK (2,5)
    // White moves east to (2,4): approach captures (2,5); withdrawal captures (2,2).
    const s = stateWith("tsivy", [
      [2, 2, "black"],
      [2, 3, "white"],
      [2, 5, "black"],
    ]);
    const moves = legalMoves(s).filter(
      (m) =>
        m.from.r === 2 &&
        m.from.c === 3 &&
        m.direction.dr === 0 &&
        m.direction.dc === 1,
    );
    const modes = moves.map((m) => m.mode).sort();
    expect(modes).toEqual(["approach", "withdrawal"]);
  });
});

describe("weak intersections", () => {
  it("cannot move diagonally from a weak intersection", () => {
    // (2,3) is weak: r+c=5 odd. Place white there, with empty diagonal neighbors.
    const s = stateWith("tsivy", [[2, 3, "white"]]);
    const diagonal = legalMoves(s).filter(
      (m) => m.direction.dr !== 0 && m.direction.dc !== 0,
    );
    expect(diagonal).toHaveLength(0);
  });

  it("can move diagonally from a strong intersection", () => {
    // (2,4) is strong: r+c=6 even.
    const s = stateWith("tsivy", [[2, 4, "white"]]);
    const diagonal = legalMoves(s).filter(
      (m) => m.direction.dr !== 0 && m.direction.dc !== 0,
    );
    expect(diagonal.length).toBeGreaterThan(0);
  });
});
