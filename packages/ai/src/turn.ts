import {
  applyMove,
  endTurn,
  legalContinuations,
  legalMoves,
  type GameState,
  type Move,
} from "@fanorona/engine";

export interface FullTurn {
  /** Sequence of one or more Moves that make up this turn, in order. */
  readonly moves: readonly Move[];
  /** State after the turn has fully resolved (turn has passed to opponent). */
  readonly resulting: GameState;
  /** True if the player voluntarily stopped a chain that could have continued. */
  readonly stoppedEarly: boolean;
}

/**
 * Enumerate every complete turn the current player could make from `state`.
 * A complete turn is either a single paika move (when no capture exists) or
 * one or more capturing moves followed by a voluntary stop (`endTurn`) or an
 * automatic stop (no legal continuation). Each stopping point is a distinct turn.
 */
export function enumerateFullTurns(state: GameState): FullTurn[] {
  if (state.winner !== null) return [];
  if (state.chain !== null) {
    // Caller should normally pass a fresh state; be permissive and continue
    // the existing chain from here.
    return explorePartialChain(state);
  }
  const out: FullTurn[] = [];
  const legal = legalMoves(state);
  if (legal.length === 0) return out;
  const hasCapture = legal.some((m) => m.mode !== "paika");

  if (!hasCapture) {
    for (const m of legal) {
      out.push({ moves: [m], resulting: applyMove(state, m), stoppedEarly: false });
    }
    return out;
  }

  for (const m of legal) {
    if (m.mode === "paika") continue;
    exploreFromCapture(state, m, [], out);
  }
  return out;
}

function exploreFromCapture(
  state: GameState,
  move: Move,
  prefix: readonly Move[],
  out: FullTurn[],
): void {
  const next = applyMove(state, move);
  const chain = [...prefix, move];

  if (next.chain === null) {
    // Chain ended automatically — either because no continuation exists or
    // because the opponent has been wiped out.
    out.push({ moves: chain, resulting: next, stoppedEarly: false });
    return;
  }

  // Option: stop here voluntarily.
  out.push({ moves: chain, resulting: endTurn(next), stoppedEarly: true });

  // Option: keep chaining.
  for (const cont of legalContinuations(next)) {
    exploreFromCapture(next, cont, chain, out);
  }
}

function explorePartialChain(state: GameState): FullTurn[] {
  const out: FullTurn[] = [];
  // Voluntary stop: just end the turn.
  out.push({ moves: [], resulting: endTurn(state), stoppedEarly: true });
  for (const cont of legalContinuations(state)) {
    exploreFromCapture(state, cont, [], out);
  }
  return out;
}

/** Total number of opponent stones this turn removes. */
export function turnCaptureCount(turn: FullTurn): number {
  let n = 0;
  for (const m of turn.moves) n += m.captured.length;
  return n;
}
