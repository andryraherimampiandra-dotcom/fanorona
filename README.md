# Fanorona

An app around the Malagasy board game Fanorona, built as a monorepo.

## Status

- **`packages/engine/`** — Pure TypeScript rules engine, 22 tests.
  All three variants (Telo 3×3, Dimy 5×5, Tsivy 9×5). Strong/weak
  intersections, approach + withdrawal captures, mandatory capture,
  approach/withdrawal choice, chain restrictions (no revisit, no repeated
  direction), voluntary chain termination, win on no-stones / no-moves.
- **`packages/ai/`** — Negamax + alpha-beta search with iterative deepening,
  14 tests. Enumerates complete turns (including every voluntary stopping
  point of a chain). Difficulty presets:

  | Preset | Time   | Depth cap | Opening on Tsivy (with TT) |
  |--------|--------|-----------|----------------------------|
  | easy   | 150 ms | 2         | d2, ~10 ms, ~23 nodes   |
  | medium | 500 ms | 4         | d4, ~125 ms, ~1 k nodes |
  | hard   | 2 s    | 6         | d6, ~1.8 s, ~28 k nodes |

  Transposition table (Zobrist-hashed) persists across iterative deepening
  iterations and shares scores between root moves that lead to the same
  position. At 10 s hard reaches d7 on Tsivy opening.

- **`apps/cli/`** — Terminal Fanorona. Human vs AI, or AI vs AI.

## Try it

```bash
cd packages/engine && npm test       # 22 tests
cd ../ai && npm test                 # 14 tests
cd ../../apps/cli && npm run play -- --variant tsivy --human white --difficulty medium
# AI self-play:
cd ../../apps/cli && npm run selfplay -- --variant tsivy --white hard --black medium
```

## Roadmap

1. ✅ Engine + tests.
2. ✅ AI + tests + CLI.
3. ✅ Mobile UI (Expo + React Native + SVG). 2D top-down board, tap-to-select,
   legal-move highlights, approach/withdrawal choice modal, mid-chain Stop,
   undo, variant + difficulty picker, score tags, win banner.
4. ✅ Tutorial / puzzles. Six scripted lessons teaching movement, approach,
   withdrawal, mandatory capture, the approach-vs-withdrawal choice, and
   chain restrictions. Menu + lesson screen with retry.
5. ✅ AI strengthening pass. Zobrist hashing + transposition table (persists
   across iterative deepening). Hard preset now reaches one extra ply within
   the same 2 s budget.
6. ✅ Online play. Tiny Node + ws server, 4-char room codes, authoritative
   engine, reconnect grace window, state-sync protocol in a shared types
   package. Mobile client: Online screen with server URL + room code entry,
   optimistic local apply + server-authoritative reconcile.
7. **(Nice-to-have)** 3D board, stone animations, opening book, make-unmake,
   rating / lobby system, persistent accounts.

## Running the mobile app

```bash
cd apps/mobile
npm install
npx expo start               # phone (Expo Go or dev build)
npx expo start --web         # browser preview
```

## Running the online server

```bash
cd packages/server
npm install
npm run start                # ws://0.0.0.0:8787
npm run smoke                # end-to-end check (no external deps)
```

In the mobile app, tap **Online ›** on the game screen. Both players
enter the server URL and the same 4-char room code; first to join is
white.

## Layout

```
packages/engine/     Pure TS rules engine (22 tests)
packages/ai/         Negamax + Zobrist + TT search (14 tests)
packages/protocol/   Shared wire-format types (client ⇄ server)
packages/server/     Node + ws realtime server, authoritative
apps/cli/            Terminal UI: human vs AI, AI vs AI
apps/mobile/         Expo (iOS + Android + Web) UI
```
