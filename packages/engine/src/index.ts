export * from "./types.js";
export {
  ALL_DIRECTIONS,
  DIAGONAL,
  ORTHOGONAL,
  VARIANTS,
  cellAt,
  countStones,
  directionsFrom,
  emptyBoard,
  inBounds,
  isStrong,
  opponentOf,
  opposite,
  positionsEqual,
  sameDirection,
  setCell,
  startingBoard,
  step,
} from "./board.js";
export { hasAnyCapture, legalContinuations, legalMoves } from "./moves.js";
export {
  applyMove,
  endTurn,
  hasCaptureAvailable,
  newGame,
  pieceAt,
} from "./game.js";
