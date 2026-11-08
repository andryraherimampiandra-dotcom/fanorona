import React, { useState } from "react";
import GameScreen from "./src/screens/GameScreen.js";
import TutorialMenu from "./src/screens/TutorialMenu.js";
import LessonScreen from "./src/screens/LessonScreen.js";
import OnlineScreen from "./src/screens/OnlineScreen.js";
import { LESSONS, type Lesson } from "./src/data/lessons.js";

type Screen =
  | { kind: "game" }
  | { kind: "menu" }
  | { kind: "lesson"; lesson: Lesson }
  | { kind: "online" };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "game" });

  switch (screen.kind) {
    case "game":
      return (
        <GameScreen
          onOpenTutorial={() => setScreen({ kind: "menu" })}
          onOpenOnline={() => setScreen({ kind: "online" })}
        />
      );
    case "menu":
      return (
        <TutorialMenu
          onBack={() => setScreen({ kind: "game" })}
          onPickLesson={(lesson) => setScreen({ kind: "lesson", lesson })}
        />
      );
    case "lesson": {
      const idx = LESSONS.findIndex((l) => l.id === screen.lesson.id);
      const next = idx >= 0 && idx < LESSONS.length - 1 ? LESSONS[idx + 1] : undefined;
      return (
        <LessonScreen
          lesson={screen.lesson}
          onBack={() => setScreen({ kind: "menu" })}
          {...(next ? { onNext: () => setScreen({ kind: "lesson", lesson: next }) } : {})}
        />
      );
    }
    case "online":
      return <OnlineScreen onBack={() => setScreen({ kind: "game" })} />;
  }
}
