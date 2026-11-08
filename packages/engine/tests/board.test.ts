import { describe, expect, it } from "vitest";
import {
  countStones,
  directionsFrom,
  isStrong,
  startingBoard,
  VARIANTS,
} from "../src/board.js";

describe("variants and starting positions", () => {
  it("Tsivy starts with 22 white + 22 black and empty center", () => {
    const v = VARIANTS.tsivy;
    const b = startingBoard(v);
    expect(countStones(b, "white")).toBe(22);
    expect(countStones(b, "black")).toBe(22);
    expect(b[2]?.[4]).toBe("empty");
  });

  it("Tsivy middle row alternates W B W B _ W B W B", () => {
    const v = VARIANTS.tsivy;
    const b = startingBoard(v);
    expect(b[2]).toEqual([
      "white",
      "black",
      "white",
      "black",
      "empty",
      "white",
      "black",
      "white",
      "black",
    ]);
  });

  it("Dimy starts with 12 white + 12 black and empty center", () => {
    const v = VARIANTS.dimy;
    const b = startingBoard(v);
    expect(countStones(b, "white")).toBe(12);
    expect(countStones(b, "black")).toBe(12);
    expect(b[2]?.[2]).toBe("empty");
  });

  it("Telo starts with 4 white + 4 black and empty center", () => {
    const v = VARIANTS.telo;
    const b = startingBoard(v);
    expect(countStones(b, "white")).toBe(4);
    expect(countStones(b, "black")).toBe(4);
    expect(b[1]?.[1]).toBe("empty");
  });
});

describe("strong vs weak intersections", () => {
  it("center and corners are strong on Tsivy", () => {
    expect(isStrong({ r: 0, c: 0 })).toBe(true);
    expect(isStrong({ r: 0, c: 8 })).toBe(true);
    expect(isStrong({ r: 4, c: 0 })).toBe(true);
    expect(isStrong({ r: 4, c: 8 })).toBe(true);
    expect(isStrong({ r: 2, c: 4 })).toBe(true);
  });

  it("adjacent intersections are weak", () => {
    expect(isStrong({ r: 0, c: 1 })).toBe(false);
    expect(isStrong({ r: 1, c: 0 })).toBe(false);
    expect(isStrong({ r: 2, c: 3 })).toBe(false);
  });

  it("strong intersections have 8 directions, weak have 4", () => {
    expect(directionsFrom({ r: 2, c: 4 }).length).toBe(8);
    expect(directionsFrom({ r: 2, c: 3 }).length).toBe(4);
  });
});
