import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type Position,
  type VariantId,
} from "@fanorona/engine";
import { DIFFICULTY, chooseTurn } from "@fanorona/ai";

export type Difficulty = keyof typeof DIFFICULTY;

export interface GameConfig {
  readonly variant: VariantId;
  readonly humanColor: Player;
  readonly difficulty: Difficulty;
}

export interface MoveChoice {
  readonly from: Position;
  readonly to: Position;
  readonly approach?: Move;
  readonly withdrawal?: Move;
}

export interface UseGameApi {
  readonly state: GameState;
  readonly config: GameConfig;
  readonly selected: Position | null;
  /** Destinations (as "r,c" keys) the selected stone can legally reach. */
  readonly destinations: ReadonlyMap<string, Move[]>;
  /** Positions of stones involved in the current turn so the UI can trail them. */
  readonly lastTurnTrail: readonly Position[];
  /** When a destination matches both approach + withdrawal, this is non-null. */
  readonly pendingChoice: MoveChoice | null;
  readonly aiThinking: boolean;
  readonly canUndo: boolean;
  readonly selectStone: (p: Position) => void;
  readonly tapDestination: (p: Position) => void;
  readonly resolveChoice: (mode: "approach" | "withdrawal") => void;
  readonly stopChain: () => void;
  readonly undo: () => void;
  readonly reset: (config?: Partial<GameConfig>) => void;
}

const DEFAULT_CONFIG: GameConfig = {
  variant: "tsivy",
  humanColor: "white",
  difficulty: "medium",
};

function posKey(p: Position): string {
  return `${p.r},${p.c}`;
}

export function useGame(initial: Partial<GameConfig> = {}): UseGameApi {
  const [config, setConfig] = useState<GameConfig>({ ...DEFAULT_CONFIG, ...initial });
  const [state, setState] = useState<GameState>(() => newGame(config.variant));
  const [history, setHistory] = useState<GameState[]>([]);
  const [selected, setSelected] = useState<Position | null>(null);
  const [pendingChoice, setPendingChoice] = useState<MoveChoice | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [turnTrail, setTurnTrail] = useState<Position[]>([]);
  const skipTurnCommit = useRef(false);

  const isHumansTurn = state.toMove === config.humanColor && state.winner === null;

  // Legal source positions for the human: either the chain's active stone or any
  // stone that can start a legal move this turn.
  const legal = useMemo<readonly Move[]>(() => {
    if (!isHumansTurn) return [];
    return state.chain ? legalContinuations(state) : legalMoves(state);
  }, [state, isHumansTurn]);

  // Destinations keyed by target cell; each key may map to 1 or 2 Moves
  // (approach, withdrawal, or paika).
  const destinations = useMemo<Map<string, Move[]>>(() => {
    const out = new Map<string, Move[]>();
    if (!selected) return out;
    for (const m of legal) {
      if (!positionsEqual(m.from, selected)) continue;
      const to = { r: m.from.r + m.direction.dr, c: m.from.c + m.direction.dc };
      const key = posKey(to);
      const arr = out.get(key) ?? [];
      arr.push(m);
      out.set(key, arr);
    }
    return out;
  }, [selected, legal]);

  const selectStone = useCallback(
    (p: Position) => {
      if (!isHumansTurn) return;
      if (state.chain) {
        // Mid-chain: the stone is fixed; tapping it is a no-op.
        if (positionsEqual(p, state.chain.at)) setSelected(p);
        return;
      }
      // Only stones that can start a legal move are selectable.
      if (legal.some((m) => positionsEqual(m.from, p))) setSelected(p);
    },
    [isHumansTurn, state.chain, legal],
  );

  const commitMove = useCallback((move: Move) => {
    setHistory((h) => [...h, state]);
    const landing = {
      r: move.from.r + move.direction.dr,
      c: move.from.c + move.direction.dc,
    };
    setTurnTrail((trail) =>
      state.chain ? [...trail, landing] : [move.from, landing],
    );
    const next = applyMove(state, move);
    setState(next);
    if (next.chain) setSelected(next.chain.at);
    else {
      setSelected(null);
      // Turn passed. Clear trail at the next tick so the opponent starts fresh.
      skipTurnCommit.current = true;
    }
    setPendingChoice(null);
  }, [state]);

  const tapDestination = useCallback(
    (p: Position) => {
      if (!isHumansTurn || !selected) return;
      const moves = destinations.get(posKey(p));
      if (!moves || moves.length === 0) return;

      if (moves.length === 1) {
        commitMove(moves[0]!);
        return;
      }
      const approach = moves.find((m) => m.mode === "approach");
      const withdrawal = moves.find((m) => m.mode === "withdrawal");
      setPendingChoice({
        from: selected,
        to: p,
        ...(approach ? { approach } : {}),
        ...(withdrawal ? { withdrawal } : {}),
      });
    },
    [isHumansTurn, selected, destinations, commitMove],
  );

  const resolveChoice = useCallback(
    (mode: "approach" | "withdrawal") => {
      if (!pendingChoice) return;
      const move = mode === "approach" ? pendingChoice.approach : pendingChoice.withdrawal;
      if (move) commitMove(move);
    },
    [pendingChoice, commitMove],
  );

  const stopChain = useCallback(() => {
    if (!state.chain) return;
    setHistory((h) => [...h, state]);
    setState(endTurn(state));
    setSelected(null);
    skipTurnCommit.current = true;
  }, [state]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1]!;
      setState(prev);
      setSelected(null);
      setPendingChoice(null);
      setTurnTrail([]);
      return h.slice(0, -1);
    });
  }, []);

  const reset = useCallback(
    (over: Partial<GameConfig> = {}) => {
      const next = { ...config, ...over };
      setConfig(next);
      setState(newGame(next.variant));
      setHistory([]);
      setSelected(null);
      setPendingChoice(null);
      setTurnTrail([]);
    },
    [config],
  );

  // AI turn. Run it after the UI gets a chance to render the human's final move.
  useEffect(() => {
    if (state.winner !== null) return;
    if (state.toMove === config.humanColor) return;
    if (aiThinking) return;
    setAiThinking(true);
    const aiColor: Player = opponentOf(config.humanColor);
    const t = setTimeout(() => {
      try {
        const result = chooseTurn(state, DIFFICULTY[config.difficulty]);
        // Snapshot current state for undo, then jump to the turn's resulting state.
        setHistory((h) => [...h, state]);
        const landings: Position[] = [];
        for (const m of result.turn.moves) {
          const to = { r: m.from.r + m.direction.dr, c: m.from.c + m.direction.dc };
          if (landings.length === 0) landings.push(m.from);
          landings.push(to);
        }
        setTurnTrail(landings);
        setState(result.turn.resulting);
        if (aiColor !== result.turn.resulting.toMove) {
          // Resulting state is opponent's (human's) turn — good.
        }
      } finally {
        setAiThinking(false);
      }
    }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, config.humanColor, config.difficulty]);

  return {
    state,
    config,
    selected,
    destinations,
    lastTurnTrail: turnTrail,
    pendingChoice,
    aiThinking,
    canUndo: history.length > 0 && !aiThinking,
    selectStone,
    tapDestination,
    resolveChoice,
    stopChain,
    undo,
    reset,
  };
}
