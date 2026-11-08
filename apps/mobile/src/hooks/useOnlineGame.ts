import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyMove,
  endTurn,
  legalContinuations,
  legalMoves,
  positionsEqual,
  type GameState,
  type Move,
  type Player,
  type Position,
  type VariantId,
} from "@fanorona/engine";
import {
  PROTOCOL_VERSION,
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
  type WireMove,
} from "@fanorona/protocol";
import type { MoveChoice } from "./useGame.js";

export type ConnStatus =
  | "idle"
  | "connecting"
  | "joining"
  | "waiting-for-opponent"
  | "connected"
  | "opponent-left"
  | "closed"
  | "error";

export interface OnlineOptions {
  readonly serverUrl: string;
  readonly roomCode: string;
  readonly variant?: VariantId;
  /** If provided, reuse this clientId (for reconnect). */
  readonly clientId?: string;
}

export interface UseOnlineGameApi {
  readonly status: ConnStatus;
  readonly errorMessage: string | null;
  readonly state: GameState | null;
  readonly youAre: Player | null;
  readonly opponentPresent: boolean;
  readonly selected: Position | null;
  readonly destinations: ReadonlyMap<string, Move[]>;
  readonly lastTurnTrail: readonly Position[];
  readonly pendingChoice: MoveChoice | null;
  readonly clientId: string;
  readonly selectStone: (p: Position) => void;
  readonly tapDestination: (p: Position) => void;
  readonly resolveChoice: (mode: "approach" | "withdrawal") => void;
  readonly stopChain: () => void;
  readonly resign: () => void;
  readonly leave: () => void;
  readonly rematch: () => void;
}

function posKey(p: Position): string {
  return `${p.r},${p.c}`;
}

function makeClientId(): string {
  // Tiny UUID-ish; collision rate is irrelevant for our 2-player rooms.
  const hex = (n: number) => Math.floor(Math.random() * 0x1_0000).toString(16).padStart(4, "0");
  return `${hex(0)}${hex(0)}-${hex(0)}-${hex(0)}-${hex(0)}${hex(0)}${hex(0)}`;
}

function noopWS(): WebSocket | null {
  return null;
}

export function useOnlineGame(opts: OnlineOptions): UseOnlineGameApi {
  const clientIdRef = useRef<string>(opts.clientId ?? makeClientId());
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [youAre, setYouAre] = useState<Player | null>(null);
  const [opponentPresent, setOpponentPresent] = useState(false);
  const [selected, setSelected] = useState<Position | null>(null);
  const [pendingChoice, setPendingChoice] = useState<MoveChoice | null>(null);
  const [trail, setTrail] = useState<Position[]>([]);
  const wsRef = useRef<WebSocket | null>(noopWS());
  const nonceRef = useRef(0);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify(msg));
  }, []);

  // Open the socket and join the room on mount / when opts change.
  useEffect(() => {
    let cancelled = false;
    setStatus("connecting");
    setErrorMessage(null);

    let ws: WebSocket;
    try {
      ws = new WebSocket(opts.serverUrl);
    } catch (e) {
      setStatus("error");
      setErrorMessage(e instanceof Error ? e.message : "Could not open socket");
      return () => {};
    }
    wsRef.current = ws;

    ws.onopen = () => {
      if (cancelled) return;
      setStatus("joining");
    };
    ws.onclose = () => {
      if (cancelled) return;
      setStatus((prev) => (prev === "connected" || prev === "opponent-left" ? "closed" : prev));
    };
    ws.onerror = () => {
      if (cancelled) return;
      setStatus("error");
      setErrorMessage("Connection error");
    };
    ws.onmessage = (ev) => {
      if (cancelled) return;
      const raw = typeof ev.data === "string" ? ev.data : "";
      const msg = parseServerMessage(raw);
      if (!msg) return;
      handleServer(msg);
    };

    function handleServer(msg: ServerMessage): void {
      switch (msg.kind) {
        case "welcome": {
          if (msg.protocol !== PROTOCOL_VERSION) {
            setStatus("error");
            setErrorMessage(`Server protocol ${msg.protocol} ≠ client ${PROTOCOL_VERSION}`);
            return;
          }
          // Server assigned us a fresh clientId on welcome; we reuse our own for reconnect.
          const payload: ClientMessage = {
            kind: "join_room",
            code: opts.roomCode,
            clientId: clientIdRef.current,
            ...(opts.variant ? { variant: opts.variant } : {}),
          };
          ws.send(JSON.stringify(payload));
          return;
        }
        case "room_joined":
          setYouAre(msg.youAre);
          setState(msg.state);
          setOpponentPresent(msg.opponentPresent);
          setStatus(msg.opponentPresent ? "connected" : "waiting-for-opponent");
          setSelected(null);
          setPendingChoice(null);
          setTrail([]);
          return;
        case "opponent_joined":
          setOpponentPresent(true);
          setStatus("connected");
          return;
        case "opponent_left":
          setOpponentPresent(false);
          setStatus("opponent-left");
          return;
        case "state_update": {
          const next = msg.state;
          // Trail the stone that just moved, if any.
          if (msg.lastMove) {
            const to = {
              r: msg.lastMove.from.r + msg.lastMove.direction.dr,
              c: msg.lastMove.from.c + msg.lastMove.direction.dc,
            };
            setTrail((t) => {
              if (t.length === 0) return [msg.lastMove!.from, to];
              return [...t, to];
            });
          }
          setState(next);
          // If a chain just resolved and we're not the actor, clear the local selection.
          if (next.chain === null) setSelected(null);
          return;
        }
        case "turn_passed":
          setTrail([]);
          return;
        case "game_over":
          setState(msg.state);
          setSelected(null);
          setPendingChoice(null);
          return;
        case "ack":
          return;
        case "error":
          // Server rejected a move / request. Show to UI; don't crash.
          setErrorMessage(msg.message);
          return;
        case "pong":
          return;
      }
    }

    return () => {
      cancelled = true;
      try {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ kind: "leave" }));
      } catch {
        /* ignore */
      }
      ws.close();
      wsRef.current = null;
    };
  }, [opts.serverUrl, opts.roomCode, opts.variant]);

  const legal = useMemo<readonly Move[]>(() => {
    if (!state || !youAre) return [];
    if (state.winner !== null) return [];
    if (state.toMove !== youAre) return [];
    return state.chain ? legalContinuations(state) : legalMoves(state);
  }, [state, youAre]);

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

  const sendMove = useCallback(
    (move: Move) => {
      if (!state || !youAre || state.toMove !== youAre) return;
      const nonce = `n${++nonceRef.current}`;
      const wire: WireMove = {
        from: move.from,
        direction: move.direction,
        mode: move.mode,
      };
      send({ kind: "move", move: wire, nonce });
      // Optimistic local apply so the UI responds immediately; server state replaces on next update.
      const next = applyMove(state, move);
      const landing = { r: move.from.r + move.direction.dr, c: move.from.c + move.direction.dc };
      setTrail((t) => (state.chain ? [...t, landing] : [move.from, landing]));
      setState(next);
      setPendingChoice(null);
      if (next.chain) setSelected(next.chain.at);
      else setSelected(null);
    },
    [state, youAre, send],
  );

  const selectStone = useCallback(
    (p: Position) => {
      if (!state || !youAre || state.toMove !== youAre) return;
      if (state.chain) {
        if (positionsEqual(p, state.chain.at)) setSelected(p);
        return;
      }
      if (legal.some((m) => positionsEqual(m.from, p))) setSelected(p);
    },
    [state, youAre, legal],
  );

  const tapDestination = useCallback(
    (p: Position) => {
      if (!selected) return;
      const moves = destinations.get(posKey(p));
      if (!moves || moves.length === 0) return;
      if (moves.length === 1) {
        sendMove(moves[0]!);
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
    [selected, destinations, sendMove],
  );

  const resolveChoice = useCallback(
    (mode: "approach" | "withdrawal") => {
      if (!pendingChoice) return;
      const move = mode === "approach" ? pendingChoice.approach : pendingChoice.withdrawal;
      if (move) sendMove(move);
    },
    [pendingChoice, sendMove],
  );

  const stopChain = useCallback(() => {
    if (!state || !state.chain || !youAre || state.toMove !== youAre) return;
    const nonce = `n${++nonceRef.current}`;
    send({ kind: "end_turn", nonce });
    setState(endTurn(state));
    setSelected(null);
  }, [state, youAre, send]);

  const resign = useCallback(() => send({ kind: "resign" }), [send]);
  const leave = useCallback(() => send({ kind: "leave" }), [send]);
  const rematch = useCallback(() => send({ kind: "rematch" }), [send]);

  return {
    status,
    errorMessage,
    state,
    youAre,
    opponentPresent,
    selected,
    destinations,
    lastTurnTrail: trail,
    pendingChoice,
    clientId: clientIdRef.current,
    selectStone,
    tapDestination,
    resolveChoice,
    stopChain,
    resign,
    leave,
    rematch,
  };
}
