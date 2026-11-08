import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  applyMove,
  endTurn,
  legalContinuations,
  legalMoves,
  newGame,
  opponentOf,
  type GameState,
  type Move,
  type Player,
  type VariantId,
} from "@fanorona/engine";
import { DIFFICULTY, chooseTurn } from "@fanorona/ai";
import { describeMove, renderBoard } from "./render.js";

interface Args {
  variant: VariantId;
  human: Player;
  difficulty: "easy" | "medium" | "hard";
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const variant = (get("--variant") ?? "tsivy") as VariantId;
  const human = (get("--human") ?? "white") as Player;
  const difficulty = (get("--difficulty") ?? "medium") as Args["difficulty"];
  return { variant, human, difficulty };
}

async function askNumber(
  rl: readline.Interface,
  prompt: string,
  min: number,
  max: number,
  extra: readonly string[] = [],
): Promise<string | number> {
  while (true) {
    const answer = (await rl.question(prompt)).trim().toLowerCase();
    if (extra.includes(answer)) return answer;
    const n = Number(answer);
    if (Number.isInteger(n) && n >= min && n <= max) return n;
    output.write(`Enter a number ${min}..${max}${extra.length ? ` or ${extra.join("/")}` : ""}.\n`);
  }
}

function printMoves(moves: readonly Move[]): void {
  moves.forEach((m, i) => output.write(`  ${i + 1}. ${describeMove(m)}\n`));
}

async function humanTurn(
  state: GameState,
  rl: readline.Interface,
): Promise<GameState> {
  let s = state;
  while (true) {
    output.write("\n" + renderBoard(s) + "\n\n");

    if (s.chain === null) {
      const moves = legalMoves(s);
      if (moves.length === 0) return s;
      output.write("Your legal moves:\n");
      printMoves(moves);
      const pick = await askNumber(rl, "Pick a move (number): ", 1, moves.length);
      s = applyMove(s, moves[Number(pick) - 1]!);
      if (s.chain === null) return s; // paika or auto-ended chain
      continue;
    }

    // Mid-chain: offer continuations plus a stop option.
    const conts = legalContinuations(s);
    if (conts.length === 0) {
      // Shouldn't happen — engine auto-ends such chains — but be defensive.
      return endTurn(s);
    }
    output.write("Chain active — continuations:\n");
    printMoves(conts);
    output.write(`  ${conts.length + 1}. stop here (end turn)\n`);
    const pick = await askNumber(rl, "Pick (number or 's' to stop): ", 1, conts.length + 1, ["s"]);
    if (pick === "s" || pick === conts.length + 1) return endTurn(s);
    s = applyMove(s, conts[Number(pick) - 1]!);
  }
}

function aiTurn(state: GameState, difficulty: Args["difficulty"]): GameState {
  const result = chooseTurn(state, DIFFICULTY[difficulty]);
  output.write(
    `\nAI (${state.toMove.toUpperCase()}, depth ${result.depthReached}, ${result.nodes} nodes, ${result.elapsedMs}ms):\n`,
  );
  for (const m of result.turn.moves) output.write(`  · ${describeMove(m)}\n`);
  if (result.turn.stoppedEarly) output.write("  · (stopped chain voluntarily)\n");
  return result.turn.resulting;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const rl = readline.createInterface({ input, output });
  try {
    let state = newGame(args.variant);
    const ai: Player = opponentOf(args.human);

    output.write(
      `Fanorona — ${state.variant.label}. You are ${args.human.toUpperCase()}. ` +
        `Opponent is AI (${args.difficulty}).\n`,
    );

    while (state.winner === null) {
      if (state.toMove === args.human) {
        state = await humanTurn(state, rl);
      } else {
        state = aiTurn(state, args.difficulty);
      }
    }
    output.write("\n" + renderBoard(state) + "\n\n");
    if (state.winner === "draw") output.write("Draw.\n");
    else output.write(`${state.winner.toUpperCase()} wins.\n`);
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
