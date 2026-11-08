import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import {
  parseClientMessage,
  PROTOCOL_VERSION,
  ROOM_CODE_RE,
  type ClientMessage,
  type ServerMessage,
  type WireMove,
} from "@fanorona/protocol";
import type { Player, VariantId } from "@fanorona/engine";
import {
  applyEndTurn,
  applyWireMove,
  colorOf,
  createRoom,
  freeSlot,
  resign,
  type Room,
} from "./room.js";

const DEFAULT_PORT = Number(process.env.PORT ?? 8787);
const RECONNECT_GRACE_MS = 30_000;
const IDLE_PING_INTERVAL_MS = 25_000;
const ROOM_SWEEP_INTERVAL_MS = 60_000;

const rooms = new Map<string, Room>();
const socketClientIds = new WeakMap<WebSocket, string>();
const socketRoomCodes = new WeakMap<WebSocket, string>();

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(msg));
}

function sendToColor(room: Room, color: Player, msg: ServerMessage): void {
  const slot = color === "white" ? room.white : room.black;
  if (slot && slot.socket instanceof WebSocket) send(slot.socket, msg);
}

function broadcast(room: Room, msg: ServerMessage): void {
  if (room.white?.socket instanceof WebSocket) send(room.white.socket, msg);
  if (room.black?.socket instanceof WebSocket) send(room.black.socket, msg);
}

function joinRoom(
  ws: WebSocket,
  clientId: string,
  code: string,
  variant: VariantId | undefined,
): void {
  if (!ROOM_CODE_RE.test(code)) {
    send(ws, { kind: "error", code: "bad_room_code", message: "Room codes are 4 chars A–Z0–9." });
    return;
  }

  let room = rooms.get(code);
  if (!room) {
    room = createRoom(code, variant ?? "tsivy");
    rooms.set(code, room);
    console.log(`[room ${code}] created (${room.state.variant.id})`);
  }

  // Reconnect: same clientId as an existing slot.
  const previous = colorOf(room, clientId);
  let assigned: Player | null = previous;
  if (previous === null) {
    assigned = freeSlot(room);
    if (assigned === null) {
      send(ws, { kind: "error", code: "room_full", message: "Room is full." });
      return;
    }
  }

  const slot = { clientId, socket: ws, disconnectedAt: null };
  if (assigned === "white") room.white = slot;
  else if (assigned === "black") room.black = slot;

  socketClientIds.set(ws, clientId);
  socketRoomCodes.set(ws, code);

  const opponent: Player = assigned === "white" ? "black" : "white";
  const opponentPresent =
    (opponent === "white" ? room.white : room.black)?.socket instanceof WebSocket &&
    (opponent === "white" ? room.white : room.black)!.disconnectedAt === null;

  send(ws, {
    kind: "room_joined",
    code,
    youAre: assigned!,
    state: room.state,
    opponentPresent,
  });

  // Tell the opponent someone joined (fresh or reconnect).
  if (opponentPresent) {
    sendToColor(room, opponent, { kind: "opponent_joined", color: assigned! });
  }
  console.log(`[room ${code}] ${assigned} joined as ${clientId.slice(0, 6)}…`);
}

function handleMove(ws: WebSocket, move: WireMove, nonce: string): void {
  const roomCode = socketRoomCodes.get(ws);
  const clientId = socketClientIds.get(ws);
  if (!roomCode || !clientId) {
    send(ws, { kind: "error", code: "not_in_room", message: "Join a room first.", nonce });
    return;
  }
  const room = rooms.get(roomCode);
  if (!room) {
    send(ws, { kind: "error", code: "not_in_room", message: "Room is gone.", nonce });
    return;
  }
  const color = colorOf(room, clientId);
  if (color === null) {
    send(ws, { kind: "error", code: "not_in_room", message: "You're not in this room.", nonce });
    return;
  }

  try {
    const { nextState, applied, turnPassed } = applyWireMove(room.state, color, move);
    room.state = nextState;
    send(ws, { kind: "ack", nonce });

    const wireLast: WireMove = {
      from: applied.from,
      direction: applied.direction,
      mode: applied.mode,
    };
    broadcast(room, { kind: "state_update", state: nextState, lastMove: wireLast });

    if (nextState.winner !== null) {
      broadcast(room, {
        kind: "game_over",
        state: nextState,
        reason:
          nextState.winner === "draw"
            ? "draw"
            : "no_stones",
      });
      return;
    }
    if (turnPassed) {
      broadcast(room, { kind: "turn_passed", state: nextState, actor: color });
    }
  } catch (err) {
    const code =
      err instanceof Error && (err.message === "not_your_turn" || err.message === "illegal_move" || err.message === "game_over")
        ? err.message
        : "illegal_move";
    send(ws, {
      kind: "error",
      code: code as "not_your_turn" | "illegal_move" | "game_over",
      message: `Move rejected: ${code}.`,
      nonce,
    });
  }
}

function handleEndTurn(ws: WebSocket, nonce: string): void {
  const roomCode = socketRoomCodes.get(ws);
  const clientId = socketClientIds.get(ws);
  if (!roomCode || !clientId) return;
  const room = rooms.get(roomCode);
  if (!room) return;
  const color = colorOf(room, clientId);
  if (color === null) return;

  try {
    const next = applyEndTurn(room.state, color);
    room.state = next;
    send(ws, { kind: "ack", nonce });
    broadcast(room, { kind: "state_update", state: next, lastMove: null });
    broadcast(room, { kind: "turn_passed", state: next, actor: color });
  } catch (err) {
    send(ws, {
      kind: "error",
      code: "illegal_move",
      message: "Cannot end turn — not mid-chain.",
      nonce,
    });
  }
}

function handleResign(ws: WebSocket): void {
  const roomCode = socketRoomCodes.get(ws);
  const clientId = socketClientIds.get(ws);
  if (!roomCode || !clientId) return;
  const room = rooms.get(roomCode);
  if (!room) return;
  const color = colorOf(room, clientId);
  if (color === null) return;
  room.state = resign(room.state, color);
  broadcast(room, { kind: "game_over", state: room.state, reason: "resignation" });
}

function handleLeave(ws: WebSocket): void {
  const code = socketRoomCodes.get(ws);
  const clientId = socketClientIds.get(ws);
  if (!code || !clientId) return;
  const room = rooms.get(code);
  if (!room) return;
  const color = colorOf(room, clientId);
  if (!color) return;
  // Mark the slot disconnected immediately rather than waiting for ws close.
  const slot = color === "white" ? room.white : room.black;
  if (slot) slot.disconnectedAt = Date.now();
  socketClientIds.delete(ws);
  socketRoomCodes.delete(ws);
  const opp: Player = color === "white" ? "black" : "white";
  sendToColor(room, opp, { kind: "opponent_left", graceSeconds: RECONNECT_GRACE_MS / 1000 });
}

function startIdleSweeper(): void {
  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      let changed = false;
      for (const color of ["white", "black"] as const) {
        const slot = color === "white" ? room.white : room.black;
        if (!slot) continue;
        if (slot.disconnectedAt !== null && now - slot.disconnectedAt > RECONNECT_GRACE_MS) {
          if (color === "white") room.white = null;
          else room.black = null;
          changed = true;
          console.log(`[room ${code}] ${color} slot freed after grace`);
        }
      }
      // Garbage-collect empty rooms older than a minute.
      if (!room.white && !room.black && now - room.createdAt > ROOM_SWEEP_INTERVAL_MS) {
        rooms.delete(code);
        console.log(`[room ${code}] deleted (empty)`);
      } else if (changed) {
        // Notify any remaining opponent that the slot is free again.
      }
    }
  }, 5_000).unref();
}

function handle(ws: WebSocket, raw: string): void {
  const msg = parseClientMessage(raw);
  if (!msg) {
    send(ws, { kind: "error", code: "bad_message", message: "Could not parse message." });
    return;
  }
  switch (msg.kind) {
    case "join_room":
      return joinRoom(ws, msg.clientId, msg.code, msg.variant);
    case "move":
      return handleMove(ws, msg.move, msg.nonce);
    case "end_turn":
      return handleEndTurn(ws, msg.nonce);
    case "resign":
      return handleResign(ws);
    case "leave":
      return handleLeave(ws);
    case "rematch": {
      const code = socketRoomCodes.get(ws);
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      room.state = createRoom(code, room.state.variant.id).state;
      broadcast(room, { kind: "state_update", state: room.state, lastMove: null });
      return;
    }
    case "ping":
      send(ws, { kind: "pong" });
      return;
  }
}

function onClose(ws: WebSocket): void {
  const code = socketRoomCodes.get(ws);
  const clientId = socketClientIds.get(ws);
  if (!code || !clientId) return;
  const room = rooms.get(code);
  if (!room) return;
  const color = colorOf(room, clientId);
  if (!color) return;
  const slot = color === "white" ? room.white : room.black;
  if (slot) slot.disconnectedAt = Date.now();
  const opp: Player = color === "white" ? "black" : "white";
  sendToColor(room, opp, { kind: "opponent_left", graceSeconds: RECONNECT_GRACE_MS / 1000 });
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
};

function serveStatic(req: IncomingMessage, res: ServerResponse, rootDir: string): void {
  const url = req.url?.split("?")[0] ?? "/";
  // SPA fallback: if the path has no extension, serve index.html.
  let rel = decodeURIComponent(url === "/" ? "/index.html" : url);
  const safe = normalize(rel).replace(/^\/+/, "");
  const target = resolve(rootDir, safe);
  if (!target.startsWith(rootDir + sep) && target !== rootDir) {
    res.writeHead(403).end("forbidden");
    return;
  }
  let path = target;
  if (!existsSync(path) || !statSync(path).isFile()) {
    // SPA fallback for client-side routes.
    path = join(rootDir, "index.html");
    if (!existsSync(path)) {
      res.writeHead(404).end("not found");
      return;
    }
  }
  const type = MIME[extname(path).toLowerCase()] ?? "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Cache-Control": "public, max-age=300" });
  createReadStream(path).pipe(res);
}

export function startServer(port = DEFAULT_PORT, staticRoot?: string): WebSocketServer {
  const http = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" }).end("ok");
      return;
    }
    if (staticRoot) {
      serveStatic(req, res, staticRoot);
    } else {
      res.writeHead(200, { "Content-Type": "text/plain" }).end("Fanorona server\n");
    }
  });
  // Upgrade WS only on /ws so the HTTP root stays available for the SPA.
  const wss = new WebSocketServer({ noServer: true });
  http.on("upgrade", (req, socket, head) => {
    if ((req.url ?? "").split("?")[0] !== "/ws") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });
  wss.on("connection", (ws) => {
    const clientId = randomUUID();
    send(ws, { kind: "welcome", protocol: PROTOCOL_VERSION, clientId });
    const pinger = setInterval(() => {
      if (ws.readyState === ws.OPEN) ws.ping();
    }, IDLE_PING_INTERVAL_MS);
    ws.on("message", (data) => {
      try {
        handle(ws, data.toString());
      } catch (err) {
        console.error("handler threw", err);
      }
    });
    ws.on("close", () => {
      clearInterval(pinger);
      onClose(ws);
    });
    ws.on("error", (err) => {
      console.warn("ws error", err.message);
    });
  });
  startIdleSweeper();
  http.listen(port, "0.0.0.0", () => {
    console.log(
      `Fanorona server listening on :${port}${staticRoot ? ` (static root: ${staticRoot})` : ""}`,
    );
  });
  return wss;
}

// Direct-invoke entry point.
if (import.meta.url === `file://${process.argv[1]}`) {
  const staticRoot = process.env.STATIC_ROOT
    ? resolve(process.env.STATIC_ROOT)
    : existsSync(resolve(process.cwd(), "public"))
      ? resolve(process.cwd(), "public")
      : undefined;
  startServer(DEFAULT_PORT, staticRoot);
}
