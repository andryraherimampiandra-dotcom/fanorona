import type { GameState } from "@fanorona/engine";

/**
 * Seeded Zobrist hashing. We only ever hash states where no chain is in flight
 * (search enumerates full turns, so chain mid-states never reach the TT), which
 * means {board, toMove} is the entire key.
 */

const MAX_CELLS = 9 * 9; // enough for Telo/Dimy/Tsivy and any future rectangular variant up to 9×9.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rand64(rng: () => number): bigint {
  const hi = BigInt(Math.floor(rng() * 0x1_0000_0000));
  const lo = BigInt(Math.floor(rng() * 0x1_0000_0000));
  return (hi << 32n) | lo;
}

const rng = mulberry32(0xFA_1C_8E_EA); // deterministic seed so TT is reproducible.
const Z_WHITE: readonly bigint[] = Array.from({ length: MAX_CELLS }, () => rand64(rng));
const Z_BLACK: readonly bigint[] = Array.from({ length: MAX_CELLS }, () => rand64(rng));
const Z_TO_MOVE_BLACK: bigint = rand64(rng);

function cellIndex(r: number, c: number): number {
  return r * 9 + c; // fixed stride matches MAX_CELLS layout.
}

export function hashState(state: GameState): bigint {
  let h = 0n;
  const rows = state.variant.rows;
  const cols = state.variant.cols;
  for (let r = 0; r < rows; r++) {
    const row = state.board[r];
    if (!row) continue;
    for (let c = 0; c < cols; c++) {
      const cell = row[c];
      if (cell === "empty") continue;
      const idx = cellIndex(r, c);
      h ^= cell === "white" ? Z_WHITE[idx]! : Z_BLACK[idx]!;
    }
  }
  if (state.toMove === "black") h ^= Z_TO_MOVE_BLACK;
  return h;
}

/** Compact string key so the table can use `Map<string, …>` without bigint-key quirks. */
export function hashKey(state: GameState): string {
  return hashState(state).toString(36);
}
