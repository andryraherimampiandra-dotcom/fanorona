// Dynamic Expo config. Reads FANORONA_SERVER_URL at build time so the APK
// ships with the deployed server baked in. Falls back to localhost for dev.
module.exports = ({ config }) => ({
  ...config,
  name: "Fanorona",
  slug: "fanorona",
  version: "0.1.0",
  orientation: "portrait",
  scheme: "fanorona",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: { supportsTablet: true, bundleIdentifier: "com.fanorona.app" },
  android: { package: "com.fanorona.app" },
  web: { bundler: "metro" },
  extra: {
    // Only baked in when FANORONA_SERVER_URL is set at build time. When unset,
    // the web client uses same-origin (wss://<page-host>/ws) so a Cloudflare
    // Tunnel URL just works without rebuilding.
    serverUrl: process.env.FANORONA_SERVER_URL || undefined,
    eas: {
      // Fill in after `eas init` on your machine; the Expo CLI prompts for this.
      projectId: process.env.EAS_PROJECT_ID ?? undefined,
    },
  },
});
