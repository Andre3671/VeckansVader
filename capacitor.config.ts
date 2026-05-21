import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "se.veckansvader.app",
  appName: "Veckans Väder",
  // Where the static web bundle lives after `npm run build:app`.
  webDir: "out",
  // No live-reload server; the bundled assets are served from inside the app.
  server: {
    androidScheme: "https",
  },
  android: {
    // Allow opening external links (e.g. weather.com, providers' websites)
    // in the system browser rather than inside the app.
    allowMixedContent: false,
  },
  plugins: {
    // Patches global fetch to go through native HTTP, bypassing the WebView's
    // same-origin policy. Without this, calls to https://veckansvader.se
    // from the in-app https://localhost origin would be blocked by CORS.
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0b1226",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0b1226",
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#6366f1",
    },
    Preferences: {
      // Custom SharedPreferences name so the native widget can read the same
      // storage. Android default for the plugin is "CapacitorStorage".
      group: "VeckansVaderPrefs",
    },
  },
};

export default config;
