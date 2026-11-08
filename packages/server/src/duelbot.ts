/**
 * Live end-to-end demo: two WebSocket clients join the same room and play a
 * complete game against each other via the authoritative server. The AI picks
 * each side's moves. The server doesn't know these are bots.
 */
import { WebSocket } from "ws";
import type { GameState, Move, Player } from "@fanorona/engine";
import {
  parseServerMessage,
  type ClientMessage,
  type ServerMessage,
  type WireMove,
} from "@fanorona/protocol";
import { DIFFICULTY, chooseTurn } from "@fanorona/ai";
import { startServer } from "./server.js";

const VARIANT = (process.argv.find((a) => a.startsWith("--variant="))?.slice(10) ??
  "telo") as "telo" | "dimy" | "tsivy";
const CODE = (process.argv.find((a) => a.startsWith("--code="))?.slice(7) ?? "DEMO").toUpperCase();
const MAX_HALF_TURNS = Number(process.argv.find((a) => a.startsWith("--max="))?.slice(6) ?? 40);

const PORT = 18788;
const URL = `ws://127.0.0.1:${PORT}/ws`;

interface Client {
  readonly name: string;
  readonly ws: WebSocket;
  readonly queue: ServerMessage[];
  readonly waiters: Array<(m: ServerMessage) => void>;
  clientId: string;
  color: Player | null;
  state: GameState | null;
}

function connect(name: string): Promise<Client> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    const c: Client = {
      name,
      ws,
      queue: [],
      waiters: [],
      clientId: "",
      color: null,
      state: null,
    };
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

function nextMessage(c: Client, timeoutMs = 5000): Promise<ServerMessage> {
  const buf = c.queue.shift();
  if (buf) return Promise.resolve(buf);
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      const i = c.waiters.indexOf(resolve);
      if (i >= 0) c.waiters.splice(i, 1);
      reject(new Error(`${c.name}: timeout`));
    }, timeoutMs);
    c.waiters.push((m) => {
      clearTimeout(t);
      resolve(m);
    });
  });
}

/**
 * Pull the next message, updating `c.state` if it carries a state update,
 * until we see one matching `pred`. Any unmatched messages are side-effected
 * on and then discarded (they were just state-syncs).
 */
async function pullUntil(
  c: Client,
  pred: (m: ServerMessage) => boolean,
  timeoutMs = 5000,
): Promise<ServerMessage> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const msg = await nextMessage(c, deadline - Date.now());
    if (msg.kind === "state_update" || msg.kind === "turn_passed" || msg.kind === "game_over") {
      c.state = msg.state;
    }
    if (pred(msg)) return msg;
  }
  throw new Error(`${c.name}: timeout waiting for predicate`);
}

function send(c: Client, msg: ClientMessage): void {
  c.ws.send(JSON.stringify(msg));
}

function drawBoard(state: GameState): string {
  const rows: string[] = [];
  for (let r = 0; r < state.variant.rows; r++) {
    const cells: string[] = [];
    for (let c = 0; c < state.variant.cols; c++) {
      const v = state.board[r]?.[c];
      cells.push(v === "white" ? "O" : v === "black" ? "X" : "·");
    }
    rows.push(` ${cells.join(" ")}`);
  }
  return rows.join("\n");
}

function moveLabel(m: Move): string {
  const from = `${String.fromCharCode(97 + m.from.c)}${m.from.r + 1}`;
  const to = `${String.fromCharCode(97 + m.from.c + m.direction.dc)}${m.from.r + m.direction.dr + 1}`;
  const tag = m.mode === "paika" ? "paika" : `${m.mode} ×${m.captured.length}`;
  return `${from}→${to} (${tag})`;
}

async function playTurn(c: Client): Promise<string[]> {
  if (!c.state || !c.color || c.state.toMove !== c.color) return [];
  if (c.state.winner !== null) return [];

  const plan = chooseTurn(c.state, DIFFICULTY.easy);
  const labels: string[] = [];
  for (let i = 0; i < plan.turn.moves.length; i++) {
    const move = plan.turn.moves[i]!;
    const wire: WireMove = {
      from: move.from,
      direction: move.direction,
      mode: move.mode,
    };
    const nonce = `${c.name}-${Date.now()}-${i}`;
    send(c, { kind: "move", move: wire, nonce });
    const res = await pullUntil(c, (m) => m.kind === "ack" || m.kind === "error");
    if (res.kind === "error") {
      console.error(`${c.name}: server rejected move: ${res.message}`);
      return labels;
    }
    labels.push(moveLabel(move));
    // Consume the state_update that follows the ack so our local state is current.
    await pullUntil(c, (m) => m.kind === "state_update" || m.kind === "game_over" || m.kind === "turn_passed");
  }
  if (plan.turn.stoppedEarly && c.state && c.state.chain !== null) {
    const nonce = `${c.name}-stop-${Date.now()}`;
    send(c, { kind: "end_turn", nonce });
    await pullUntil(c, (m) => m.kind === "ack" || m.kind === "error");
    await pullUntil(c, (m) => m.kind === "turn_passed" || m.kind === "game_over");
    labels.push("(stopped chain)");
  }
  return labels;
}

/** The opponent's job is just to keep their state in sync while it isn't their turn. */
async function syncOpponent(c: Client, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (c.state && c.color && (c.state.toMove === c.color || c.state.winner !== null)) return;
    try {
      await pullUntil(c, () => c.state?.toMove === c.color || c.state?.winner !== null, deadline - Date.now());
      return;
    } catch {
      return;
    }
  }
}

async function main(): Promise<void> {
  const server = startServer(PORT);
  const alice = await connect("Alice");
  const bob = await connect("Bob");

  alice.clientId = ((await pullUntil(alice, (m) => m.kind === "welcome")) as { kind: "welcome"; clientId: string }).clientId;
  bob.clientId = ((await pullUntil(bob, (m) => m.kind === "welcome")) as { kind: "welcome"; clientId: string }).clientId;

  send(alice, { kind: "join_room", code: CODE, clientId: alice.clientId, variant: VARIANT });
  const joinA = (await pullUntil(alice, (m) => m.kind === "room_joined")) as Extract<ServerMessage, { kind: "room_joined" }>;
  alice.color = joinA.youAre;
  alice.state = joinA.state;

  send(bob, { kind: "join_room", code: CODE, clientId: bob.clientId });
  const joinB = (await pullUntil(bob, (m) => m.kind === "room_joined")) as Extract<ServerMessage, { kind: "room_joined" }>;
  bob.color = joinB.youAre;
  bob.state = joinB.state;

  // Drain alice's "opponent_joined" notice.
  await pullUntil(alice, (m) => m.kind === "opponent_joined");

  console.log(`\nRoom ${CODE} · ${joinA.state.variant.label}`);
  console.log(
    `${alice.name} = ${alice.color?.toUpperCase()}   ${bob.name} = ${bob.color?.toUpperCase()}`,
  );
  console.log("Initial board:");
  console.log(drawBoard(joinA.state));

  let half = 0;
  while (half < MAX_HALF_TURNS) {
    const mover = alice.state?.toMove === alice.color ? alice : bob;
    const other = mover === alice ? bob : alice;
    if (!mover.state || mover.state.winner !== null) break;

    const labels = await playTurn(mover);
    half++;
    console.log(`\n#${half} ${mover.name} (${mover.color?.toUpperCase()}):`);
    for (const l of labels) console.log(`  · ${l}`);
    console.log(drawBoard(mover.state!));
    const w = mover.state!.board.flat().filter((c) => c === "white").length;
    const b = mover.state!.board.flat().filter((c) => c === "black").length;
    const st = mover.state!;
    const winnerTag = st.winner ? ` · WINNER ${String(st.winner).toUpperCase()}` : "";
    console.log(`  stones  O=${w}  X=${b}   next: ${st.toMove.toUpperCase()}${winnerTag}`);
    if (mover.state!.winner !== null) break;
    // Let the other client catch up on broadcast messages for its turn.
    await syncOpponent(other, 1500);
  }

  console.log(`\n${half} half-turns played.`);
  if (alice.state?.winner) console.log(`WINNER: ${alice.state.winner.toUpperCase()}`);

  alice.ws.close();
  bob.ws.close();
  server.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
