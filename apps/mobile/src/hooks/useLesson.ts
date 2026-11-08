import { useCallback, useMemo, useRef, useState } from "react";
import {
  applyMove,
  cellAt,
  countStones,
  emptyBoard,
  endTurn,
  legalContinuations,
  legalMoves,
  opponentOf,
  positionsEqual,
  setCell,
  VARIANTS,
  type Cell,
  type GameState,
  type Move,
  type Player,
  type Position,
} from "@fanorona/engine";
import type { Lesson, LessonGoal } from "../data/lessons.js";
import type { MoveChoice } from "./useGame.js";

function posKey(p: Position): string {
  return `${p.r},${p.c}`;
}

function buildInitialState(lesson: Lesson): GameState {
  const variant = VARIANTS[lesson.variant];
  let board: readonly (readonly Cell[])[] = emptyBoard(variant);
  for (const [r, c, player] of lesson.startingStones) {
    board = setCell(board, { r, c }, player);
  }
  return {
    variant,
    board,
    toMove: lesson.startingPlayer,
    chain: null,
    paikaStreak: 0,
    winner: null,
  };
}

function goalReached(
  goal: LessonGoal,
  before: GameState,
  after: GameState,
  capturedThisTurn: number,
): boolean {
  switch (goal.kind) {
    case "move-made":
      return after.toMove !== before.toMove || after.winner !== null;
    case "captured-at-least":
      return capturedThisTurn >= goal.count;
    case "eliminate-opponent": {
      const opp = opponentOf(before.toMove);
      return countStones(after.board, opp) === 0;
    }
  }
}

export interface UseLessonApi {
  readonly lesson: Lesson;
  readonly state: GameState;
  readonly selected: Position | null;
  readonly destinations: ReadonlyMap<string, Move[]>;
  readonly lastTurnTrail: readonly Position[];
  readonly pendingChoice: MoveChoice | null;
  readonly succeeded: boolean;
  readonly selectStone: (p: Position) => void;
  readonly tapDestination: (p: Position) => void;
  readonly resolveChoice: (mode: "approach" | "withdrawal") => void;
  readonly stopChain: () => void;
  readonly retry: () => void;
}

export function useLesson(lesson: Lesson): UseLessonApi {
  const initialState = useMemo(() => buildInitialState(lesson), [lesson]);
  const [state, setState] = useState<GameState>(initialState);
  const [selected, setSelected] = useState<Position | null>(null);
  const [pendingChoice, setPendingChoice] = useState<MoveChoice | null>(null);
  const [trail, setTrail] = useState<Position[]>([]);
  const [succeeded, setSucceeded] = useState(false);
  const capturedThisTurn = useRef(0);

  const legal = useMemo<readonly Move[]>(() => {
    if (succeeded) return [];
    return state.chain ? legalContinuations(state) : legalMoves(state);
  }, [state, succeeded]);

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

  const commitMove = useCallback(
    (move: Move) => {
      const landing = {
        r: move.from.r + move.direction.dr,
        c: move.from.c + move.direction.dc,
      };
      capturedThisTurn.current += move.captured.length;
      setTrail((t) => (state.chain ? [...t, landing] : [move.from, landing]));
      const next = applyMove(state, move);
      setState(next);
      setPendingChoice(null);
      if (next.chain) setSelected(next.chain.at);
      else {
        setSelected(null);
        if (goalReached(lesson.goal, state, next, capturedThisTurn.current)) {
          setSucceeded(true);
        }
        capturedThisTurn.current = 0;
      }
    },
    [state, lesson.goal],
  );

  const selectStone = useCallback(
    (p: Position) => {
      if (succeeded) return;
      if (state.chain) {
        if (positionsEqual(p, state.chain.at)) setSelected(p);
        return;
      }
      if (cellAt(state.board, p) !== state.toMove) return;
      if (legal.some((m) => positionsEqual(m.from, p))) setSelected(p);
    },
    [state, legal, succeeded],
  );

  const tapDestination = useCallback(
    (p: Position) => {
      if (succeeded || !selected) return;
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
    [succeeded, selected, destinations, commitMove],
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
    const next = endTurn(state);
    setState(next);
    setSelected(null);
    if (goalReached(lesson.goal, state, next, capturedThisTurn.current)) {
      setSucceeded(true);
    }
    capturedThisTurn.current = 0;
  }, [state, lesson.goal]);

  const retry = useCallback(() => {
    setState(initialState);
    setSelected(null);
    setPendingChoice(null);
    setTrail([]);
    setSucceeded(false);
    capturedThisTurn.current = 0;
  }, [initialState]);

  return {
    lesson,
    state,
    selected,
    destinations,
    lastTurnTrail: trail,
    pendingChoice,
    succeeded,
    selectStone,
    tapDestination,
    resolveChoice,
    stopChain,
    retry,
  };
}
