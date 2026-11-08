import { newGame } from "@fanorona/engine";
import { DIFFICULTY, chooseTurn } from "@fanorona/ai";

for (const level of ["easy", "medium", "hard"] as const) {
  const s = newGame("tsivy");
  const r = chooseTurn(s, DIFFICULTY[level]);
  console.log(
    `${level}: depth=${r.depthReached} nodes=${r.nodes} tt-hits=${r.ttHits} elapsed=${r.elapsedMs}ms score=${r.score}`,
  );
}

// Ceiling test: how far can hard go with a 10 s budget?
console.log("---");
const s = newGame("tsivy");
const r = chooseTurn(s, { timeMs: 10000, maxDepth: 64 });
console.log(
  `ceiling (10s): depth=${r.depthReached} nodes=${r.nodes} tt-hits=${r.ttHits} elapsed=${r.elapsedMs}ms score=${r.score}`,
);
