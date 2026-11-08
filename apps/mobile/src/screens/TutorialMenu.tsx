import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LESSONS, type Lesson } from "../data/lessons.js";

export interface TutorialMenuProps {
  readonly onBack: () => void;
  readonly onPickLesson: (lesson: Lesson) => void;
}

export default function TutorialMenu({ onBack, onPickLesson }: TutorialMenuProps) {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Game</Text>
        </Pressable>
        <Text style={styles.title}>Learn Fanorona</Text>
        <View style={styles.backBtn} />
      </View>

      <Text style={styles.subtitle}>
        Six short drills that teach the rules step by step.
      </Text>

      <ScrollView contentContainerStyle={styles.list}>
        {LESSONS.map((lesson) => (
          <Pressable
            key={lesson.id}
            onPress={() => onPickLesson(lesson)}
            style={styles.card}
          >
            <Text style={styles.cardTitle}>{lesson.title}</Text>
            <Text style={styles.cardBody}>{lesson.summary}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
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
  subtitle: { color: "#d4a373", textAlign: "center", marginBottom: 12 },
  list: { paddingBottom: 24 },
  card: {
    backgroundColor: "#2b1d0e",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  cardTitle: { color: "#f6efe4", fontSize: 16, fontWeight: "700", marginBottom: 4 },
  cardBody: { color: "#d4a373", fontSize: 13 },
});
