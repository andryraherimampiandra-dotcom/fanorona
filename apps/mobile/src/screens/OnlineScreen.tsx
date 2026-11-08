import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { VARIANTS, countStones, type Player } from "@fanorona/engine";
import { BoardView } from "../components/BoardView.js";
import { useOnlineGame, type ConnStatus } from "../hooks/useOnlineGame.js";

export interface OnlineScreenProps {
  readonly onBack: () => void;
}

const DEFAULT_URL =
  Platform.OS === "web"
    ? typeof window !== "undefined"
      ? `ws://${window.location.hostname || "localhost"}:8787`
      : "ws://localhost:8787"
    : "ws://10.0.2.2:8787";

export default function OnlineScreen({ onBack }: OnlineScreenProps) {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [code, setCode] = useState("");
  const [config, setConfig] = useState<{ url: string; code: string } | null>(null);

  if (!config) {
    return <JoinForm url={url} code={code} setUrl={setUrl} setCode={setCode} onJoin={() => setConfig({ url, code: code.toUpperCase() })} onBack={onBack} />;
  }
  return <GameRoom url={config.url} code={config.code} onBack={() => setConfig(null)} onExit={onBack} />;
}

function JoinForm({
  url,
  code,
  setUrl,
  setCode,
  onJoin,
  onBack,
}: {
  url: string;
  code: string;
  setUrl: (s: string) => void;
  setCode: (s: string) => void;
  onJoin: () => void;
  onBack: () => void;
}) {
  const canJoin = /^[A-Za-z0-9]{4}$/.test(code.trim());
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Game</Text>
        </Pressable>
        <Text style={styles.title}>Play online</Text>
        <View style={styles.backBtn} />
      </View>
      <Text style={styles.subtitle}>
        Both players type the same 4-char room code. First to join plays white.
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>Server URL</Text>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="ws://host:8787"
          placeholderTextColor="#8a6a46"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Room code</Text>
        <TextInput
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase().slice(0, 4))}
          placeholder="ABCD"
          placeholderTextColor="#8a6a46"
          style={[styles.input, styles.codeInput]}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </View>
      <Pressable
        onPress={onJoin}
        disabled={!canJoin}
        style={[styles.joinBtn, !canJoin ? styles.joinBtnDisabled : null]}
      >
        <Text style={styles.joinBtnText}>Join room</Text>
      </Pressable>
      <Text style={styles.footnote}>
        Need a server? Run{" "}
        <Text style={styles.mono}>npm run start</Text> inside{" "}
        <Text style={styles.mono}>packages/server</Text>.
      </Text>
    </View>
  );
}

function statusLabel(status: ConnStatus, you: Player | null): string {
  switch (status) {
    case "idle":
      return "Idle";
    case "connecting":
      return "Connecting…";
    case "joining":
      return "Joining room…";
    case "waiting-for-opponent":
      return `You are ${you?.toUpperCase() ?? "?"}. Waiting for opponent…`;
    case "connected":
      return `You are ${you?.toUpperCase() ?? "?"}.`;
    case "opponent-left":
      return "Opponent left. Waiting for reconnect…";
    case "closed":
      return "Disconnected.";
    case "error":
      return "Error.";
  }
}

function GameRoom({
  url,
  code,
  onBack,
  onExit,
}: {
  url: string;
  code: string;
  onBack: () => void;
  onExit: () => void;
}) {
  const online = useOnlineGame({ serverUrl: url, roomCode: code });
  const { width, height } = useWindowDimensions();
  const boardSize = Math.min(width - 24, height - 360);

  const turnText = useMemo(() => {
    if (!online.state) return "";
    if (online.state.winner === "draw") return "Draw.";
    if (online.state.winner) return `${online.state.winner.toUpperCase()} wins!`;
    if (online.state.chain) return "Chain in progress.";
    return online.state.toMove === online.youAre ? "Your turn." : "Opponent's turn.";
  }, [online.state, online.youAre]);

  const white = online.state ? countStones(online.state.board, "white") : 0;
  const black = online.state ? countStones(online.state.board, "black") : 0;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Leave</Text>
        </Pressable>
        <Text style={styles.title}>Room {code}</Text>
        <View style={styles.backBtn} />
      </View>
      <Text style={styles.statusLine}>
        {statusLabel(online.status, online.youAre)}{" "}
        {online.opponentPresent ? "· opponent online" : ""}
      </Text>
      <Text style={styles.turnLine}>{turnText}</Text>

      {online.state && (
        <>
          <View style={styles.scoreRow}>
            <ScoreTag color="white" count={white} />
            <View style={{ flex: 1 }} />
            <ScoreTag color="black" count={black} />
          </View>

          <View style={styles.boardWrap}>
            <BoardView
              state={online.state}
              selected={online.selected}
              destinations={online.destinations}
              trail={online.lastTurnTrail}
              onTapCell={(p) => {
                if (online.selected && online.destinations.has(`${p.r},${p.c}`)) {
                  online.tapDestination(p);
                } else if (online.state!.board[p.r]?.[p.c] === online.state!.toMove) {
                  online.selectStone(p);
                }
              }}
              size={boardSize}
            />
          </View>
        </>
      )}

      <View style={styles.actions}>
        <Button
          label="Stop chain"
          onPress={online.stopChain}
          disabled={!online.state?.chain}
        />
        <Button label="Resign" onPress={online.resign} />
        <Button
          label="Leave"
          onPress={() => {
            online.leave();
            onExit();
          }}
          tone="primary"
        />
      </View>

      {online.errorMessage ? (
        <Text style={styles.error}>{online.errorMessage}</Text>
      ) : null}

      <Modal visible={online.pendingChoice !== null} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Capture direction</Text>
            <Text style={styles.modalBody}>Both captures are legal. Which one?</Text>
            <View style={styles.modalActions}>
              {online.pendingChoice?.approach && (
                <Button
                  label={`Approach ×${online.pendingChoice.approach.captured.length}`}
                  onPress={() => online.resolveChoice("approach")}
                  tone="primary"
                />
              )}
              {online.pendingChoice?.withdrawal && (
                <Button
                  label={`Withdrawal ×${online.pendingChoice.withdrawal.captured.length}`}
                  onPress={() => online.resolveChoice("withdrawal")}
                  tone="primary"
                />
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!online.state?.winner} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {online.state?.winner === "draw" ? "Draw" : `${online.state?.winner?.toUpperCase()} wins`}
            </Text>
            <Text style={styles.modalBody}>Room {code} · {VARIANTS[online.state?.variant.id ?? "tsivy"].label}</Text>
            <View style={styles.modalActions}>
              <Button label="Rematch" onPress={online.rematch} tone="primary" />
              <Button
                label="Exit"
                onPress={() => {
                  online.leave();
                  onExit();
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ScoreTag({ color, count }: { color: "white" | "black"; count: number }) {
  return (
    <View style={[styles.score, color === "black" ? styles.scoreBlack : styles.scoreWhite]}>
      <Text style={[styles.scoreText, color === "black" ? styles.scoreTextBlack : styles.scoreTextWhite]}>
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
  root: { flex: 1, backgroundColor: "#1a1613", paddingTop: 44, paddingHorizontal: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  backBtn: { minWidth: 70, paddingVertical: 6 },
  backText: { color: "#d4a373", fontSize: 15 },
  title: { color: "#f6efe4", fontSize: 18, fontWeight: "700", flex: 1, textAlign: "center" },
  subtitle: { color: "#d4a373", textAlign: "center", marginBottom: 16, fontSize: 13 },
  field: { marginBottom: 12 },
  label: { color: "#d4a373", marginBottom: 6, fontSize: 13 },
  input: {
    backgroundColor: "#2b1d0e",
    color: "#f6efe4",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  codeInput: { letterSpacing: 6, textAlign: "center", fontSize: 24 },
  joinBtn: {
    backgroundColor: "#2a9d8f",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  joinBtnDisabled: { opacity: 0.4 },
  joinBtnText: { color: "#f6efe4", fontWeight: "700" },
  footnote: { color: "#8a6a46", marginTop: 20, fontSize: 12, textAlign: "center" },
  mono: { fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }), color: "#d4a373" },
  statusLine: { color: "#2a9d8f", textAlign: "center", marginVertical: 4, fontSize: 13 },
  turnLine: { color: "#f6efe4", textAlign: "center", marginBottom: 6, fontWeight: "600" },
  scoreRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
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
  boardWrap: { alignItems: "center", marginVertical: 6 },
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
  error: { color: "#e76f51", textAlign: "center", marginTop: 6, fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#f6efe4", borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1a1613", marginBottom: 4 },
  modalBody: { color: "#2b1d0e", marginBottom: 14 },
  modalActions: { flexDirection: "row" },
});
