import {
  countStones,
  directionsFrom,
  opponentOf,
  type GameState,
  type Player,
} from "@fanorona/engine";

/** Big enough to dominate any material term but small enough to keep arithmetic safe. */
export const WIN_SCORE = 1_000_000;

const MATERIAL_WEIGHT = 100;
const MOBILITY_WEIGHT = 2;
const CENTER_WEIGHT = 3;

/**
 * Static evaluation from the perspective of `state.toMove`.
 * Positive = good for the player to move.
 */
export function evaluate(state: GameState): number {
  if (state.winner === "draw") return 0;
  if (state.winner !== null) {
    return state.winner === state.toMove ? WIN_SCORE : -WIN_SCORE;
  }

  const me = state.toMove;
  const them = opponentOf(me);

  const material = countStones(state.board, me) - countStones(state.board, them);
  const mobility = countReachableSquares(state, me) - countReachableSquares(state, them);
  const center = centerControl(state, me) - centerControl(state, them);

  return (
    material * MATERIAL_WEIGHT +
    mobility * MOBILITY_WEIGHT +
    center * CENTER_WEIGHT
  );
}

/**
 * Cheap mobility proxy: count stone-adjacent empty squares for `player`. Doesn't
 * require generating moves (which would require toggling state.toMove).
 */
function countReachableSquares(state: GameState, player: Player): number {
  const board = state.board;
  const v = state.variant;
  let n = 0;
  for (let r = 0; r < v.rows; r++) {
    for (let c = 0; c < v.cols; c++) {
      if (board[r]?.[c] !== player) continue;
      for (const d of directionsFrom({ r, c })) {
        const nr = r + d.dr;
        const nc = c + d.dc;
        if (nr < 0 || nr >= v.rows || nc < 0 || nc >= v.cols) continue;
        if (board[nr]?.[nc] === "empty") n++;
      }
    }
  }
  return n;
}

/** Stones occupying the central 3×3 (or the full board on Telo) area. */
function centerControl(state: GameState, player: Player): number {
  const v = state.variant;
  const centerR = Math.floor(v.rows / 2);
  const centerC = Math.floor(v.cols / 2);
  const radius = v.id === "telo" ? 1 : 1;
  let n = 0;
  for (let r = centerR - radius; r <= centerR + radius; r++) {
    for (let c = centerC - radius; c <= centerC + radius; c++) {
      if (r < 0 || r >= v.rows || c < 0 || c >= v.cols) continue;
      if (state.board[r]?.[c] === player) n++;
    }
  }
  return n;
}
