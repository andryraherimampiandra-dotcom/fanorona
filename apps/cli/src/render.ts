import type { Direction, GameState, Move, Variant } from "@fanorona/engine";
import { isStrong } from "@fanorona/engine";

const WHITE = "O";
const BLACK = "X";
const EMPTY = "·";

export function renderBoard(state: GameState, highlight?: ReadonlySet<string>): string {
  const v = state.variant;
  const lines: string[] = [];
  const header = "   " + columnLabels(v).map((c) => ` ${c}`).join("");
  lines.push(header);
  for (let r = 0; r < v.rows; r++) {
    const parts: string[] = [`${r + 1} `];
    for (let c = 0; c < v.cols; c++) {
      const cell = state.board[r]?.[c] ?? "empty";
      const strong = isStrong({ r, c });
      const marker =
        cell === "white" ? WHITE : cell === "black" ? BLACK : strong ? EMPTY : "·";
      const isHi = highlight?.has(`${r},${c}`) ?? false;
      parts.push(" " + (isHi ? `[${marker}]` : ` ${marker} `).slice(0, 3));
    }
    lines.push(parts.join(""));
  }
  lines.push("");
  lines.push(`Turn: ${state.toMove.toUpperCase()}   O = white, X = black`);
  return lines.join("\n");
}

function columnLabels(v: Variant): string[] {
  return Array.from({ length: v.cols }, (_, c) => String.fromCharCode(97 + c));
}

export function describeDirection(d: Direction): string {
  const key = `${d.dr},${d.dc}`;
  const map: Record<string, string> = {
    "-1,0": "N",
    "1,0": "S",
    "0,-1": "W",
    "0,1": "E",
    "-1,-1": "NW",
    "-1,1": "NE",
    "1,-1": "SW",
    "1,1": "SE",
  };
  return map[key] ?? key;
}

export function describeMove(m: Move): string {
  const from = `${String.fromCharCode(97 + m.from.c)}${m.from.r + 1}`;
  const dir = describeDirection(m.direction);
  const to = {
    r: m.from.r + m.direction.dr,
    c: m.from.c + m.direction.dc,
  };
  const toLabel = `${String.fromCharCode(97 + to.c)}${to.r + 1}`;
  const mode =
    m.mode === "paika"
      ? "paika"
      : m.mode === "approach"
      ? `approach ×${m.captured.length}`
      : `withdrawal ×${m.captured.length}`;
  return `${from}→${toLabel} (${dir}, ${mode})`;
}
