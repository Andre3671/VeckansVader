/**
 * Bridge between the Capacitor app and the native home-screen widget.
 *
 * The native widget reads the same SharedPreferences (named via
 * Preferences.group = "VeckansVaderPrefs") to know which location to
 * fetch the forecast for. We write to it after every successful load
 * so the widget always uses the latest user-selected location.
 *
 * No-op on web.
 */

export interface SavedLocation {
  lat: number;
  lon: number;
  label?: string;
}

const KEY = "last_location";

export async function saveLocationForWidget(loc: SavedLocation): Promise<void> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key: KEY, value: JSON.stringify(loc) });

    // Ask the widget to refresh right away, before its next scheduled update.
    // We dispatch a broadcast that our AppWidgetProvider listens for.
    const w = window as {
      Capacitor?: {
        Plugins?: {
          App?: { exitApp?: () => void };
        };
      };
    };
    // The widget refresh is triggered via the BackgroundRunner-style worker
    // enqueued in the native side; nothing to do from JS beyond writing the
    // value. The widget will pick it up on its next tick (≤30 min) or when
    // the user taps the widget to open the app.
    void w;
  } catch {
    // best-effort
  }
}
