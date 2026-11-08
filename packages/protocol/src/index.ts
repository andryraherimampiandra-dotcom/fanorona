import type {
  Direction,
  GameState,
  Player,
  Position,
  VariantId,
} from "@fanorona/engine";

/** Protocol version — bump on any breaking change. */
export const PROTOCOL_VERSION = 1;

/** Room codes are uppercase A–Z and digits, 4 characters. */
export const ROOM_CODE_RE = /^[A-Z0-9]{4}$/;

/** Compact move payload the client sends to the server. */
export interface WireMove {
  readonly from: Position;
  readonly direction: Direction;
  readonly mode: "approach" | "withdrawal" | "paika";
}

/** A completed turn as applied by the server (one or more moves in order). */
export interface WireTurn {
  readonly actor: Player;
  readonly moves: readonly WireMove[];
  readonly captured: readonly Position[];
  readonly stoppedEarly: boolean;
}

export type ClientMessage =
  | {
      readonly kind: "join_room";
      readonly code: string;
      readonly variant?: VariantId;
      readonly clientId: string;
    }
  | { readonly kind: "move"; readonly move: WireMove; readonly nonce: string }
  | { readonly kind: "end_turn"; readonly nonce: string }
  | { readonly kind: "resign" }
  | { readonly kind: "rematch" }
  | { readonly kind: "leave" }
  | { readonly kind: "ping" };

export type ServerMessage =
  | {
      readonly kind: "welcome";
      readonly protocol: number;
      readonly clientId: string;
    }
  | {
      readonly kind: "room_joined";
      readonly code: string;
      readonly youAre: Player;
      readonly state: GameState;
      readonly opponentPresent: boolean;
    }
  | {
      readonly kind: "opponent_joined";
      readonly color: Player;
    }
  | {
      readonly kind: "opponent_left";
      readonly graceSeconds: number;
    }
  | {
      readonly kind: "state_update";
      readonly state: GameState;
      readonly lastMove: WireMove | null;
    }
  | {
      readonly kind: "turn_passed";
      readonly state: GameState;
      readonly actor: Player;
    }
  | {
      readonly kind: "game_over";
      readonly state: GameState;
      readonly reason: "no_stones" | "no_moves" | "draw" | "resignation";
    }
  | {
      readonly kind: "ack";
      readonly nonce: string;
    }
  | {
      readonly kind: "error";
      readonly code:
        | "bad_message"
        | "bad_room_code"
        | "room_full"
        | "not_your_turn"
        | "illegal_move"
        | "not_in_room"
        | "game_over";
      readonly message: string;
      readonly nonce?: string;
    }
  | { readonly kind: "pong" };

/** Safe parse — returns null on structural failure instead of throwing. */
export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj.kind !== "string") return null;
    return obj as ClientMessage;
  } catch {
    return null;
  }
}

export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj.kind !== "string") return null;
    return obj as ServerMessage;
  } catch {
    return null;
  }
}
