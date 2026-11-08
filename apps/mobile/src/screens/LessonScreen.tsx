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
import { BoardView } from "../components/BoardView.js";
import { useLesson } from "../hooks/useLesson.js";
import type { Lesson } from "../data/lessons.js";

export interface LessonScreenProps {
  readonly lesson: Lesson;
  readonly onBack: () => void;
  readonly onNext?: () => void;
}

export default function LessonScreen({ lesson, onBack, onNext }: LessonScreenProps) {
  const l = useLesson(lesson);
  const { width, height } = useWindowDimensions();
  const boardSize = Math.min(width - 24, height - 420);

  const status = useMemo(() => {
    if (l.succeeded) return "Correct — well done.";
    if (l.state.chain) return "Chain in progress — keep going or Stop.";
    return "Your turn — follow the goal.";
  }, [l.succeeded, l.state.chain]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Lessons</Text>
        </Pressable>
        <Text style={styles.title}>{lesson.title}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.explain}>
        <Text style={styles.summary}>{lesson.summary}</Text>
        <Text style={styles.body}>{lesson.explanation}</Text>
        <Text style={styles.hint}>
          <Text style={styles.hintLabel}>Hint. </Text>
          {lesson.hint}
        </Text>
      </ScrollView>

      <Text style={styles.status}>{status}</Text>

      <View style={styles.boardWrap}>
        <BoardView
          state={l.state}
          selected={l.selected}
          destinations={l.destinations}
          trail={l.lastTurnTrail}
          onTapCell={(p) => {
            if (l.selected && l.destinations.has(`${p.r},${p.c}`)) {
              l.tapDestination(p);
            } else if (l.state.board[p.r]?.[p.c] === l.state.toMove) {
              l.selectStone(p);
            }
          }}
          size={boardSize}
        />
      </View>

      <View style={styles.actions}>
        <Button
          label="Stop chain"
          onPress={l.stopChain}
          disabled={l.state.chain === null}
        />
        <Button label="Retry" onPress={l.retry} />
      </View>

      <Modal
        visible={l.pendingChoice !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Capture direction</Text>
            <Text style={styles.modalBody}>Both captures are legal. Which one?</Text>
            <View style={styles.modalActions}>
              {l.pendingChoice?.approach && (
                <Button
                  label={`Approach ×${l.pendingChoice.approach.captured.length}`}
                  onPress={() => l.resolveChoice("approach")}
                  tone="primary"
                />
              )}
              {l.pendingChoice?.withdrawal && (
                <Button
                  label={`Withdrawal ×${l.pendingChoice.withdrawal.captured.length}`}
                  onPress={() => l.resolveChoice("withdrawal")}
                  tone="primary"
                />
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={l.succeeded} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Lesson complete</Text>
            <Text style={styles.modalBody}>Nicely done.</Text>
            <View style={styles.modalActions}>
              <Button label="Back" onPress={onBack} />
              {onNext ? <Button label="Next" onPress={onNext} tone="primary" /> : null}
            </View>
          </View>
        </View>
      </Modal>
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
    marginBottom: 4,
  },
  backBtn: { minWidth: 70, paddingVertical: 6 },
  backText: { color: "#d4a373", fontSize: 15 },
  title: {
    color: "#f6efe4",
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  explain: { maxHeight: 140, marginVertical: 8 },
  summary: { color: "#d4a373", fontWeight: "700", fontSize: 14, marginBottom: 4 },
  body: { color: "#f6efe4", fontSize: 14, lineHeight: 20 },
  hint: { color: "#2a9d8f", fontSize: 13, marginTop: 8 },
  hintLabel: { fontWeight: "700" },
  status: { color: "#f6efe4", textAlign: "center", paddingVertical: 6 },
  boardWrap: { alignItems: "center" },
  actions: { flexDirection: "row", marginTop: 8 },
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
