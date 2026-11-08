# Deploying Fanorona

Two artifacts to get online:

1. A public **WebSocket + web server** (one HTTPS host serves both).
2. A **downloadable Android APK** that connects to it.

Everything in here runs from your laptop — this repo already contains all the
config files. You need accounts on Fly.io (or Railway / Render) and Expo.

---

## 1. Deploy the server to Fly.io

```bash
# One-time: install flyctl, sign in, create the app.
brew install flyctl          # or: curl -L https://fly.io/install.sh | sh
fly auth signup              # or `fly auth login`

# From the repo root — fly.toml and Dockerfile are already here.
fly launch --copy-config --no-deploy   # confirms the app name "fanorona-server"
fly deploy
```

After `fly deploy`, you'll see something like:

```
https://fanorona-server.fly.dev
```

That URL serves:

- `https://fanorona-server.fly.dev/`  → the web app (Expo export)
- `wss://fanorona-server.fly.dev/ws`  → the Fanorona game server
- `https://fanorona-server.fly.dev/health` → health check

Smoke test it:

```bash
curl https://fanorona-server.fly.dev/health      # → ok
open  https://fanorona-server.fly.dev            # → the game UI
```

Two browser tabs on that URL + the same room code = a live online match.

> **Pick a different app name?** Edit `app = "fanorona-server"` at the top of
> `fly.toml` and change `FANORONA_SERVER_URL` in `apps/mobile/eas.json` to
> `wss://<your-app-name>.fly.dev/ws`.

**Alternative hosts:** Railway, Render, Cloud Run, and any other PaaS that
takes a Dockerfile and exposes an HTTPS URL will work identically. They all
auto-upgrade WebSocket on the same HTTPS hostname.

---

## 2. Build the Android APK with EAS

```bash
# One-time.
npm install -g eas-cli
cd apps/mobile
eas login
eas init           # creates the project on your Expo account
                   # paste the printed projectId into app.config.js if asked
```

The server URL is already baked into `eas.json` under the `preview` profile.
If your Fly app name differs from `fanorona-server`, update
`FANORONA_SERVER_URL` in `apps/mobile/eas.json` before building.

```bash
# Build a signed APK. Takes ~15 min in Expo's cloud. No local Android setup needed.
eas build --platform android --profile preview
```

When it's done the CLI prints a download URL — something like:

```
https://expo.dev/artifacts/eas/<id>.apk
```

Share that URL. Anyone with an Android device can download and install the
APK (they'll need to allow installs from unknown sources once). It connects
to the Fly.io server you deployed in step 1.

---

## iOS (optional)

Same flow, different profile. iOS distribution needs an Apple Developer
account ($99/year). For sharing with testers only (no App Store):

```bash
eas build --platform ios --profile preview   # outputs a .ipa for TestFlight / Ad Hoc
```

Full App Store: `eas build --platform ios --profile production` then
`eas submit`.

---

## Running the server locally (no deploy)

```bash
cd packages/server
npm install
npm run start               # serves on :8787 (API + /ws, no static root)
# or with the web build bundled:
cd ../../apps/mobile && npx expo export --platform web --output-dir ../../packages/server/public
cd ../../packages/server && npm run start
# → http://localhost:8787 serves the web app and ws://localhost:8787/ws
```

Play two tabs at `http://localhost:8787` with the same 4-char room code.

---

## Costs / limits

| Service | Free tier reality |
|---|---|
| Fly.io   | 3 shared-cpu VMs free, auto-stops when idle. Fanorona easily fits. |
| Railway  | $5/mo credit, usage-based. Fine for small traffic. |
| Render   | Free web services spin down after 15 min of inactivity (cold start). |
| Expo EAS | 30 free builds / month. Each APK build takes ~15 min. |
| Google Play | $25 one-time registration (only if you want store distribution). |
