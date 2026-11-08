import { stdout as output } from "node:process";
import { newGame, type VariantId } from "@fanorona/engine";
import { DIFFICULTY, chooseTurn } from "@fanorona/ai";
import { describeMove, renderBoard } from "./render.js";

const argv = process.argv.slice(2);
function flag(name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

const variant = (flag("--variant") ?? "tsivy") as VariantId;
const whiteLvl = (flag("--white") ?? "medium") as keyof typeof DIFFICULTY;
const blackLvl = (flag("--black") ?? "medium") as keyof typeof DIFFICULTY;
const maxTurns = Number(flag("--max-turns") ?? 200);
const quiet = argv.includes("--quiet");

let state = newGame(variant);
output.write(
  `Self-play on ${state.variant.label}: WHITE=${whiteLvl} vs BLACK=${blackLvl}\n`,
);

let turn = 0;
while (state.winner === null && turn < maxTurns) {
  const settings = state.toMove === "white" ? DIFFICULTY[whiteLvl] : DIFFICULTY[blackLvl];
  const result = chooseTurn(state, settings);
  turn++;
  if (!quiet) {
    output.write(
      `\n#${turn} ${state.toMove.toUpperCase()} (d${result.depthReached}, ${result.nodes} nodes, ${result.elapsedMs}ms):\n`,
    );
    for (const m of result.turn.moves) output.write(`  · ${describeMove(m)}\n`);
  }
  state = result.turn.resulting;
}

output.write("\n" + renderBoard(state) + "\n");
if (state.winner === "draw") output.write(`Draw after ${turn} turns.\n`);
else if (state.winner) output.write(`${state.winner.toUpperCase()} wins after ${turn} turns.\n`);
else output.write(`Max turns reached (${maxTurns}).\n`);
