import {
  applyMove,
  endTurn,
  legalContinuations,
  legalMoves,
  newGame,
  opponentOf,
  positionsEqual,
  type GameState,
  type Move,
  type Player,
  type VariantId,
} from "@fanorona/engine";
import type { WireMove } from "@fanorona/protocol";

export interface PlayerSlot {
  readonly clientId: string;
  socket: unknown; // WebSocket, kept opaque to the room module
  disconnectedAt: number | null;
}

export interface Room {
  readonly code: string;
  state: GameState;
  white: PlayerSlot | null;
  black: PlayerSlot | null;
  readonly createdAt: number;
}

export function createRoom(code: string, variant: VariantId = "tsivy"): Room {
  return {
    code,
    state: newGame(variant),
    white: null,
    black: null,
    createdAt: Date.now(),
  };
}

/** Which color slot (if any) this clientId currently owns. */
export function colorOf(room: Room, clientId: string): Player | null {
  if (room.white?.clientId === clientId) return "white";
  if (room.black?.clientId === clientId) return "black";
  return null;
}

/** Find a free color slot, preferring white. Returns null if the room is full. */
export function freeSlot(room: Room): Player | null {
  if (!room.white) return "white";
  if (!room.black) return "black";
  return null;
}

export function moveEquals(a: Move, b: WireMove): boolean {
  return (
    positionsEqual(a.from, b.from) &&
    a.direction.dr === b.direction.dr &&
    a.direction.dc === b.direction.dc &&
    a.mode === b.mode
  );
}

export interface ApplyResult {
  readonly nextState: GameState;
  readonly applied: Move;
  readonly turnPassed: boolean;
}

/** Validate a WireMove against the current state and apply it. Throws on illegal. */
export function applyWireMove(state: GameState, actor: Player, move: WireMove): ApplyResult {
  if (state.winner !== null) throw new Error("game_over");
  if (state.toMove !== actor) throw new Error("not_your_turn");
  const legal = state.chain ? legalContinuations(state) : legalMoves(state);
  const match = legal.find((m) => moveEquals(m, move));
  if (!match) throw new Error("illegal_move");
  const nextState = applyMove(state, match);
  return {
    nextState,
    applied: match,
    turnPassed: nextState.chain === null,
  };
}

/**
 * Pass the turn in the middle of a chain. Only legal when the current player
 * is already mid-chain.
 */
export function applyEndTurn(state: GameState, actor: Player): GameState {
  if (state.toMove !== actor) throw new Error("not_your_turn");
  if (state.chain === null) throw new Error("illegal_move");
  return endTurn(state);
}

export function resign(state: GameState, actor: Player): GameState {
  if (state.winner !== null) return state;
  return { ...state, winner: opponentOf(actor) };
}
