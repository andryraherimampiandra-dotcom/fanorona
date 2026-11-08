import type { Player, VariantId } from "@fanorona/engine";

export type LessonGoal =
  | { readonly kind: "move-made" }
  | { readonly kind: "captured-at-least"; readonly count: number }
  | { readonly kind: "eliminate-opponent" };

export interface Lesson {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly explanation: string;
  readonly hint: string;
  readonly variant: VariantId;
  readonly startingPlayer: Player;
  readonly startingStones: readonly (readonly [number, number, Player])[];
  readonly goal: LessonGoal;
}

export const LESSONS: readonly Lesson[] = [
  {
    id: "paika-basics",
    title: "1. Movement",
    summary: "Move to an empty neighbor along a line.",
    explanation:
      "A stone moves one step along a line to an empty intersection. Strong intersections (highlighted corners, center, and the checker pattern) connect in 8 directions; weak ones only in 4 (up, down, left, right). This drill has no captures — just make any legal move.",
    hint: "Tap one of your white stones, then tap a neighboring empty intersection.",
    variant: "dimy",
    startingPlayer: "white",
    startingStones: [
      [0, 2, "white"],
      [4, 2, "black"],
    ],
    goal: { kind: "move-made" },
  },
  {
    id: "approach",
    title: "2. Approach capture",
    summary: "Move toward enemy stones to capture them.",
    explanation:
      "If you step onto an empty intersection and the next intersection in your direction has an enemy stone, you capture it — along with every contiguous enemy stone in that same direction. This is a capture by approach (percussion).",
    hint: "Move your white stone east onto the empty square beside the black line.",
    variant: "dimy",
    startingPlayer: "white",
    startingStones: [
      [2, 1, "white"],
      [2, 3, "black"],
      [2, 4, "black"],
    ],
    goal: { kind: "captured-at-least", count: 2 },
  },
  {
    id: "withdrawal",
    title: "3. Withdrawal capture",
    summary: "Move away from enemies to capture them.",
    explanation:
      "The same move can also capture by withdrawal (aspiration): step forward, and if the intersection you just left has an enemy stone immediately behind, you capture it and every contiguous enemy stone further back in that same direction.",
    hint: "Move the white stone west — away from the black line that's pressing against it.",
    variant: "dimy",
    startingPlayer: "white",
    startingStones: [
      [2, 2, "white"],
      [2, 3, "black"],
      [2, 4, "black"],
    ],
    goal: { kind: "captured-at-least", count: 2 },
  },
  {
    id: "mandatory",
    title: "4. Capture is mandatory",
    summary: "If any capture exists, you must take one.",
    explanation:
      "Non-capturing moves (paika) are only allowed when there are no captures available. If any capture is on the board, you must choose a capturing move — any one, your choice.",
    hint: "The app only highlights legal moves. Pick the capture that's on offer.",
    variant: "dimy",
    startingPlayer: "white",
    startingStones: [
      [1, 1, "white"],
      [4, 4, "white"],
      [2, 3, "black"],
      [2, 4, "black"],
    ],
    goal: { kind: "captured-at-least", count: 1 },
  },
  {
    id: "choice",
    title: "5. Approach or withdrawal?",
    summary: "Sometimes one move offers both.",
    explanation:
      "When a single step would be a capture by approach AND by withdrawal at the same time, you pick which to do. You capture one line or the other — never both from the same move.",
    hint: "Move the white stone east; a prompt will ask which capture you want.",
    variant: "dimy",
    startingPlayer: "white",
    startingStones: [
      [2, 0, "black"],
      [2, 1, "black"],
      [2, 2, "white"],
      [2, 4, "black"],
    ],
    goal: { kind: "captured-at-least", count: 1 },
  },
  {
    id: "chaining",
    title: "6. Chaining captures",
    summary: "Keep capturing, but never repeat.",
    explanation:
      "After a capture you may continue capturing with the same stone. Two restrictions: you may never revisit a square you already occupied this turn, and you may never repeat the previous direction. You can stop the chain any time.",
    hint: "Capture east to land in the center. Then turn (don't go east again) to capture another line.",
    variant: "tsivy",
    startingPlayer: "white",
    startingStones: [
      [2, 2, "white"],
      [2, 4, "black"],
      [3, 3, "black"],
      [4, 3, "black"],
    ],
    goal: { kind: "captured-at-least", count: 2 },
  },
];
