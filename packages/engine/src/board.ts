import type {
  Cell,
  Direction,
  Player,
  Position,
  Variant,
  VariantId,
} from "./types.js";

export const VARIANTS: Record<VariantId, Variant> = {
  telo: { id: "telo", rows: 3, cols: 3, stonesPerSide: 4, label: "Fanoron-Telo" },
  dimy: { id: "dimy", rows: 5, cols: 5, stonesPerSide: 12, label: "Fanoron-Dimy" },
  tsivy: { id: "tsivy", rows: 5, cols: 9, stonesPerSide: 22, label: "Fanoron-Tsivy" },
};

export const ORTHOGONAL: readonly Direction[] = [
  { dr: -1, dc: 0 },
  { dr: 1, dc: 0 },
  { dr: 0, dc: -1 },
  { dr: 0, dc: 1 },
];

export const DIAGONAL: readonly Direction[] = [
  { dr: -1, dc: -1 },
  { dr: -1, dc: 1 },
  { dr: 1, dc: -1 },
  { dr: 1, dc: 1 },
];

export const ALL_DIRECTIONS: readonly Direction[] = [...ORTHOGONAL, ...DIAGONAL];

/**
 * Strong intersections (8 directions) alternate with weak intersections (4 directions)
 * in a checkerboard pattern. On every Fanorona board the corners and the center are
 * strong, which is captured by `(r + c) % 2 === 0`.
 */
export function isStrong(p: Position): boolean {
  return (p.r + p.c) % 2 === 0;
}

export function directionsFrom(p: Position): readonly Direction[] {
  return isStrong(p) ? ALL_DIRECTIONS : ORTHOGONAL;
}

export function sameDirection(a: Direction, b: Direction): boolean {
  return a.dr === b.dr && a.dc === b.dc;
}

export function opposite(d: Direction): Direction {
  return { dr: -d.dr, dc: -d.dc };
}

export function step(p: Position, d: Direction, n = 1): Position {
  return { r: p.r + d.dr * n, c: p.c + d.dc * n };
}

export function inBounds(p: Position, v: Variant): boolean {
  return p.r >= 0 && p.r < v.rows && p.c >= 0 && p.c < v.cols;
}

export function cellAt(
  board: readonly (readonly Cell[])[],
  p: Position,
): Cell | undefined {
  return board[p.r]?.[p.c];
}

export function setCell(
  board: readonly (readonly Cell[])[],
  p: Position,
  value: Cell,
): Cell[][] {
  const next = board.map((row) => row.slice());
  const row = next[p.r];
  if (row) row[p.c] = value;
  return next;
}

export function opponentOf(player: Player): Player {
  return player === "white" ? "black" : "white";
}

export function positionsEqual(a: Position, b: Position): boolean {
  return a.r === b.r && a.c === b.c;
}

export function emptyBoard(v: Variant): Cell[][] {
  return Array.from({ length: v.rows }, () =>
    Array.from<Cell>({ length: v.cols }).fill("empty"),
  );
}

/**
 * Standard Fanorona starting position for every variant:
 * the lower half of the board is one player's territory, the upper half the other's,
 * and the middle row has an alternating pattern leaving the exact center empty.
 */
export function startingBoard(v: Variant): Cell[][] {
  const board = emptyBoard(v);
  const mid = Math.floor(v.rows / 2);
  for (let r = 0; r < v.rows; r++) {
    for (let c = 0; c < v.cols; c++) {
      const row = board[r]!;
      if (r < mid) row[c] = "white";
      else if (r > mid) row[c] = "black";
      else {
        const centerCol = Math.floor(v.cols / 2);
        if (c === centerCol) row[c] = "empty";
        else {
          // Pattern alternates by column parity, with white and black placed
          // so each side keeps its lower/upper half ownership on the midline.
          const belongsToLower = c % 2 === 0 ? (c < centerCol) : (c >= centerCol);
          row[c] = belongsToLower ? "white" : "black";
        }
      }
    }
  }
  return board;
}

export function countStones(
  board: readonly (readonly Cell[])[],
  player: Player,
): number {
  let n = 0;
  for (const row of board) for (const cell of row) if (cell === player) n++;
  return n;
}
