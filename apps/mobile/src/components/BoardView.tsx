import React, { useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Svg, { Circle, G, Line, Rect } from "react-native-svg";
import type { GameState, Move, Position } from "@fanorona/engine";
import { isStrong, positionsEqual } from "@fanorona/engine";

export interface BoardViewProps {
  readonly state: GameState;
  readonly selected: Position | null;
  readonly destinations: ReadonlyMap<string, Move[]>;
  readonly trail: readonly Position[];
  readonly onTapCell: (p: Position) => void;
  readonly size: number;
}

const COLORS = {
  board: "#d4a373",
  boardDark: "#b07c4a",
  line: "#2b1d0e",
  white: "#f6efe4",
  whiteBorder: "#2b1d0e",
  black: "#1a1613",
  blackBorder: "#f6efe4",
  select: "#2a9d8f",
  dest: "#2a9d8f",
  destHalo: "rgba(42, 157, 143, 0.28)",
  trail: "rgba(231, 111, 81, 0.75)",
  dot: "rgba(43, 29, 14, 0.55)",
};

function key(p: Position): string {
  return `${p.r},${p.c}`;
}

export function BoardView({
  state,
  selected,
  destinations,
  trail,
  onTapCell,
  size,
}: BoardViewProps) {
  const { rows, cols } = state.variant;
  const padding = 24;
  const cellW = (size - padding * 2) / (cols - 1);
  const cellH = (size - padding * 2) / (rows - 1);
  const cell = Math.min(cellW, cellH);
  const stoneR = cell * 0.36;
  const boardW = cell * (cols - 1) + padding * 2;
  const boardH = cell * (rows - 1) + padding * 2;

  const xy = (p: Position) => ({
    x: padding + p.c * cell,
    y: padding + p.r * cell,
  });

  const lines = useMemo(() => {
    const out: Array<{ a: Position; b: Position }> = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (c + 1 < cols) out.push({ a: { r, c }, b: { r, c: c + 1 } });
        if (r + 1 < rows) out.push({ a: { r, c }, b: { r: r + 1, c } });
        if ((r + c) % 2 === 0) {
          if (r + 1 < rows && c + 1 < cols)
            out.push({ a: { r, c }, b: { r: r + 1, c: c + 1 } });
          if (r + 1 < rows && c - 1 >= 0)
            out.push({ a: { r, c }, b: { r: r + 1, c: c - 1 } });
        }
      }
    }
    return out;
  }, [rows, cols]);

  const destKeys = useMemo(() => new Set(destinations.keys()), [destinations]);
  const trailKeys = useMemo(() => new Set(trail.map(key)), [trail]);

  const cellsForTouch: Position[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) cellsForTouch.push({ r, c });
  }

  return (
    <View style={[styles.wrap, { width: boardW, height: boardH }]}>
      <Svg width={boardW} height={boardH}>
        <Rect x={0} y={0} width={boardW} height={boardH} rx={12} fill={COLORS.board} />

        <G>
          {lines.map((ln, i) => {
            const a = xy(ln.a);
            const b = xy(ln.b);
            return (
              <Line
                key={`l${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={COLORS.line}
                strokeWidth={1.4}
                strokeLinecap="round"
              />
            );
          })}
        </G>

        <G>
          {Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => {
              const p = { r, c };
              const { x, y } = xy(p);
              const cell = state.board[r]?.[c] ?? "empty";
              const isSel = selected ? positionsEqual(selected, p) : false;
              const isDest = destKeys.has(key(p));
              const isTrail = trailKeys.has(key(p));

              const parts: React.ReactNode[] = [];
              if (isTrail && cell === "empty") {
                parts.push(
                  <Circle
                    key={`t${r}${c}`}
                    cx={x}
                    cy={y}
                    r={stoneR * 0.4}
                    fill={COLORS.trail}
                  />,
                );
              } else if (cell === "empty") {
                parts.push(
                  <Circle
                    key={`e${r}${c}`}
                    cx={x}
                    cy={y}
                    r={isStrong(p) ? 2.2 : 1.6}
                    fill={COLORS.dot}
                  />,
                );
              }
              if (cell !== "empty") {
                parts.push(
                  <Circle
                    key={`s${r}${c}`}
                    cx={x}
                    cy={y}
                    r={stoneR}
                    fill={cell === "white" ? COLORS.white : COLORS.black}
                    stroke={cell === "white" ? COLORS.whiteBorder : COLORS.blackBorder}
                    strokeWidth={1.2}
                  />,
                );
              }
              if (isSel) {
                parts.push(
                  <Circle
                    key={`sel${r}${c}`}
                    cx={x}
                    cy={y}
                    r={stoneR + 4}
                    stroke={COLORS.select}
                    strokeWidth={2.5}
                    fill="none"
                  />,
                );
              }
              if (isDest) {
                parts.push(
                  <Circle
                    key={`d${r}${c}`}
                    cx={x}
                    cy={y}
                    r={stoneR * 0.55}
                    fill={COLORS.destHalo}
                    stroke={COLORS.dest}
                    strokeWidth={1.4}
                  />,
                );
              }
              return parts;
            }),
          )}
        </G>
      </Svg>

      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {cellsForTouch.map((p) => {
          const { x, y } = xy(p);
          const hit = cell * 0.9;
          return (
            <Pressable
              key={`hit-${p.r}-${p.c}`}
              onPress={() => onTapCell(p)}
              style={{
                position: "absolute",
                left: x - hit / 2,
                top: y - hit / 2,
                width: hit,
                height: hit,
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    alignSelf: "center",
  },
});
