export type Player = "white" | "black";

export type Cell = "empty" | Player;

export interface Position {
  readonly r: number;
  readonly c: number;
}

export interface Direction {
  readonly dr: number;
  readonly dc: number;
}

export type CaptureMode = "approach" | "withdrawal" | "paika";

export interface Move {
  readonly from: Position;
  readonly direction: Direction;
  readonly mode: CaptureMode;
  /** Positions of the opponent stones this move removes (empty for paika). */
  readonly captured: readonly Position[];
}

export type VariantId = "telo" | "dimy" | "tsivy";

export interface Variant {
  readonly id: VariantId;
  readonly rows: number;
  readonly cols: number;
  readonly stonesPerSide: number;
  readonly label: string;
}

export interface ActiveChain {
  /** Current position of the stone that is capturing. */
  readonly at: Position;
  /** Squares the stone has occupied during this chain (includes `at`). */
  readonly visited: readonly Position[];
  /** Last direction moved, to forbid repeating it. */
  readonly lastDirection: Direction;
}

export interface GameState {
  readonly variant: Variant;
  readonly board: readonly (readonly Cell[])[];
  readonly toMove: Player;
  /** Non-null when the player is mid-chain and may continue or stop. */
  readonly chain: ActiveChain | null;
  /** Count of consecutive non-capturing (paika) half-moves — used for draw heuristic. */
  readonly paikaStreak: number;
  readonly winner: Player | "draw" | null;
}
