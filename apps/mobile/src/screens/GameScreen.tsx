import React, { useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { VARIANTS, countStones } from "@fanorona/engine";
import type { VariantId } from "@fanorona/engine";
import { BoardView } from "../components/BoardView.js";
import { useGame, type Difficulty } from "../hooks/useGame.js";

const VARIANTS_ORDER: VariantId[] = ["telo", "dimy", "tsivy"];
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export interface GameScreenProps {
  readonly onOpenTutorial?: () => void;
  readonly onOpenOnline?: () => void;
}

export default function GameScreen({
  onOpenTutorial,
  onOpenOnline,
}: GameScreenProps = {}) {
  const game = useGame({ variant: "tsivy", humanColor: "white", difficulty: "medium" });
  const { width, height } = useWindowDimensions();
  const boardSize = Math.min(width - 24, height - 340);

  const status = useMemo(() => {
    if (game.state.winner === "draw") return "Draw.";
    if (game.state.winner) return `${game.state.winner.toUpperCase()} wins!`;
    if (game.aiThinking) return "AI is thinking…";
    if (game.state.chain) return "Chain in progress — tap a target or Stop.";
    return game.state.toMove === game.config.humanColor
      ? "Your turn."
      : "Opponent's turn.";
  }, [game.state, game.aiThinking, game.config.humanColor]);

  const white = countStones(game.state.board, "white");
  const black = countStones(game.state.board, "black");

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <View style={styles.header}>
        {onOpenOnline ? (
          <Pressable onPress={onOpenOnline} style={styles.sideBtn}>
            <Text style={styles.sideBtnText}>Online ›</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Fanorona</Text>
          <Text style={styles.subtitle}>{VARIANTS[game.config.variant].label}</Text>
        </View>
        {onOpenTutorial ? (
          <Pressable onPress={onOpenTutorial} style={[styles.sideBtn, styles.sideBtnRight]}>
            <Text style={styles.sideBtnText}>Learn ›</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {VARIANTS_ORDER.map((v) => (
          <Chip
            key={v}
            label={VARIANTS[v].label.replace("Fanoron-", "")}
            active={game.config.variant === v}
            onPress={() => game.reset({ variant: v })}
          />
        ))}
        <View style={styles.divider} />
        {DIFFICULTIES.map((d) => (
          <Chip
            key={d}
            label={d}
            active={game.config.difficulty === d}
            onPress={() => game.reset({ difficulty: d })}
          />
        ))}
      </ScrollView>

      <View style={styles.scoreRow}>
        <ScoreTag color="white" count={white} />
        <Text style={styles.status}>{status}</Text>
        <ScoreTag color="black" count={black} />
      </View>

      <View style={styles.boardWrap}>
        <BoardView
          state={game.state}
          selected={game.selected}
          destinations={game.destinations}
          trail={game.lastTurnTrail}
          onTapCell={(p) => {
            const atP = game.state.board[p.r]?.[p.c];
            // Pick a destination if we've already selected a stone and this cell is a target,
            // otherwise try to select this cell as a stone.
            if (game.selected && game.destinations.has(`${p.r},${p.c}`)) {
              game.tapDestination(p);
            } else if (atP === game.state.toMove) {
              game.selectStone(p);
            }
          }}
          size={boardSize}
        />
      </View>

      <View style={styles.actionRow}>
        <Button
          label="Stop chain"
          onPress={game.stopChain}
          disabled={game.state.chain === null}
        />
        <Button label="Undo" onPress={game.undo} disabled={!game.canUndo} />
        <Button label="New game" onPress={() => game.reset()} tone="primary" />
      </View>

      <Modal
        visible={game.pendingChoice !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Capture direction</Text>
            <Text style={styles.modalBody}>
              Both captures are legal. Which one?
            </Text>
            <View style={styles.modalActions}>
              {game.pendingChoice?.approach && (
                <Button
                  label={`Approach ×${game.pendingChoice.approach.captured.length}`}
                  onPress={() => game.resolveChoice("approach")}
                  tone="primary"
                />
              )}
              {game.pendingChoice?.withdrawal && (
                <Button
                  label={`Withdrawal ×${game.pendingChoice.withdrawal.captured.length}`}
                  onPress={() => game.resolveChoice("withdrawal")}
                  tone="primary"
                />
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : null]}
    >
      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ScoreTag({ color, count }: { color: "white" | "black"; count: number }) {
  return (
    <View
      style={[
        styles.score,
        color === "black" ? styles.scoreBlack : styles.scoreWhite,
      ]}
    >
      <Text
        style={[
          styles.scoreText,
          color === "black" ? styles.scoreTextBlack : styles.scoreTextWhite,
        ]}
      >
        {color === "white" ? "O" : "X"}  {count}
      </Text>
    </View>
  );
}

function Button({
  label,
  onPress,
  disabled,
  tone,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "primary";
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        tone === "primary" ? styles.btnPrimary : null,
        disabled ? styles.btnDisabled : null,
      ]}
    >
      <Text
        style={[
          styles.btnText,
          tone === "primary" ? styles.btnTextPrimary : null,
          disabled ? styles.btnTextDisabled : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1a1613",
    paddingTop: 44,
    paddingHorizontal: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerSpacer: { minWidth: 70 },
  sideBtn: { minWidth: 70, paddingVertical: 6 },
  sideBtnRight: { alignItems: "flex-end" },
  sideBtnText: { color: "#2a9d8f", fontSize: 15, fontWeight: "600" },
  title: {
    color: "#f6efe4",
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 1,
  },
  subtitle: { color: "#d4a373", fontSize: 13, marginTop: 2 },
  chipRow: { paddingVertical: 8, alignItems: "center" },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#2b1d0e",
    marginHorizontal: 4,
  },
  chipActive: { backgroundColor: "#d4a373" },
  chipText: { color: "#d4a373", textTransform: "capitalize" },
  chipTextActive: { color: "#1a1613", fontWeight: "700" },
  divider: { width: 1, height: 20, backgroundColor: "#3a2c1c", marginHorizontal: 6 },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  status: { color: "#f6efe4", fontSize: 14, textAlign: "center", flex: 1, paddingHorizontal: 8 },
  score: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    minWidth: 54,
    alignItems: "center",
  },
  scoreWhite: { backgroundColor: "#f6efe4" },
  scoreBlack: { backgroundColor: "#2b1d0e" },
  scoreText: { fontWeight: "700" },
  scoreTextWhite: { color: "#1a1613" },
  scoreTextBlack: { color: "#f6efe4" },
  boardWrap: { alignItems: "center", marginVertical: 12 },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 4,
    backgroundColor: "#2b1d0e",
    borderRadius: 10,
    alignItems: "center",
  },
  btnPrimary: { backgroundColor: "#2a9d8f" },
  btnDisabled: { backgroundColor: "#2b1d0e", opacity: 0.4 },
  btnText: { color: "#d4a373", fontWeight: "600" },
  btnTextPrimary: { color: "#f6efe4" },
  btnTextDisabled: { color: "#d4a373" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#f6efe4",
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1a1613", marginBottom: 4 },
  modalBody: { color: "#2b1d0e", marginBottom: 14 },
  modalActions: { flexDirection: "row" },
});
