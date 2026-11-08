import { WebSocket } from "ws";
import { legalMoves } from "@fanorona/engine";
import type { GameState, Move } from "@fanorona/engine";
import {
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
  type WireMove,
} from "@fanorona/protocol";
import { startServer } from "./server.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

interface Client {
  ws: WebSocket;
  queue: ServerMessage[];
  waiters: Array<(m: ServerMessage) => void>;
}

async function connect(url: string): Promise<Client> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const c: Client = { ws, queue: [], waiters: [] };
    ws.on("message", (data) => {
      const msg = parseServerMessage(data.toString());
      if (!msg) return;
      const w = c.waiters.shift();
      if (w) w(msg);
      else c.queue.push(msg);
    });
    ws.once("open", () => resolve(c));
    ws.once("error", reject);
  });
}

function nextMessage(c: Client, timeoutMs = 2000): Promise<ServerMessage> {
  const buffered = c.queue.shift();
  if (buffered) return Promise.resolve(buffered);
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      const i = c.waiters.indexOf(resolve);
      if (i >= 0) c.waiters.splice(i, 1);
      reject(new Error("timeout waiting for message"));
    }, timeoutMs);
    c.waiters.push((m) => {
      clearTimeout(t);
      resolve(m);
    });
  });
}

async function nextOfKind<K extends ServerMessage["kind"]>(
  c: Client,
  kind: K,
  timeoutMs = 2000,
): Promise<Extract<ServerMessage, { kind: K }>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const msg = await nextMessage(c, deadline - Date.now());
    if (msg.kind === kind) return msg as Extract<ServerMessage, { kind: K }>;
  }
  throw new Error(`timeout waiting for ${kind}`);
}

function send(c: Client, msg: ClientMessage): void {
  c.ws.send(JSON.stringify(msg));
}

async function main(): Promise<void> {
  const port = 18787;
  const server = startServer(port);
  const url = `ws://127.0.0.1:${port}`;

  const a = await connect(url);
  const b = await connect(url);

  const wA = await nextOfKind(a, "welcome");
  const wB = await nextOfKind(b, "welcome");
  assert(wA.protocol === 1 && wB.protocol === 1, "protocol version");

  const CODE = "ABCD";
  send(a, { kind: "join_room", code: CODE, clientId: wA.clientId, variant: "tsivy" });
  const joinedA = await nextOfKind(a, "room_joined");
  assert(joinedA.youAre === "white", "first joiner is white");

  send(b, { kind: "join_room", code: CODE, clientId: wB.clientId });
  const joinedB = await nextOfKind(b, "room_joined");
  assert(joinedB.youAre === "black", "second joiner is black");

  // White should receive opponent_joined.
  const opp = await nextOfKind(a, "opponent_joined");
  assert(opp.color === "black", "white sees black joined");

  // Play a capturing opening move as white.
  let state: GameState = joinedA.state;
  const first = legalMoves(state).find((m: Move) => m.mode !== "paika");
  assert(!!first, "white has a capture available at the start");
  const wire: WireMove = { from: first.from, direction: first.direction, mode: first.mode };
  send(a, { kind: "move", move: wire, nonce: "n1" });

  await nextOfKind(a, "ack");
  const u = await nextOfKind(b, "state_update");
  assert(u.state.toMove === "black" || u.state.chain !== null, "turn advanced to black or chain started");

  // If white's chain continued, end it so black actually gets a move.
  if (u.state.chain !== null) {
    send(a, { kind: "end_turn", nonce: "n2" });
    await nextOfKind(a, "ack");
    const u2 = await nextOfKind(b, "state_update");
    assert(u2.state.toMove === "black" || u2.state.winner !== null, "after end_turn, black to move or game over");
    state = u2.state;
  } else {
    state = u.state;
  }

  // Try a bogus move from the wrong side (white, now black's turn).
  send(a, { kind: "move", move: wire, nonce: "bogus" });
  const err = await nextOfKind(a, "error");
  assert(err.code === "not_your_turn" || err.code === "illegal_move", "wrong-turn move rejected");

  a.ws.close();
  b.ws.close();
  server.close();
  console.log("smoke: OK (state settled at", state.toMove, ")");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
