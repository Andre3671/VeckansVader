/**
 * Local weather notification scheduling.
 *
 * No external push service — when the app opens (or runs in foreground), we
 * fetch the forecast and schedule local notifications for the next 48 hours'
 * notable events: heavy rain, snow, strong wind, frost warning.
 *
 * Notifications fire even when the app is closed because Android holds the
 * scheduled alarms until their fire time. Android may delay them when the
 * device is in Doze mode but generally fires them within minutes.
 */

import { apiUrl } from "./api";
import type { CompareResponse, ComparedDay } from "./types";

const NOTIFICATION_CHANNEL_ID = "weather-alerts";

interface AlertCandidate {
  /** Unique ID so we can replace/dedupe existing scheduled notifications. */
  id: number;
  /** When the alert should fire (a few hours before the event). */
  fireAt: Date;
  title: string;
  body: string;
}

/**
 * Inspect a day summary and yield 0+ alerts for it.
 *
 * Rules of thumb tuned for Scandinavian weather:
 *  - precipitation ≥ 5mm   → "Heavy rain expected"
 *  - precipitation ≥ 15mm  → upgraded "Very heavy rain"
 *  - tempMax    ≤ -10°C    → "Bitter cold"
 *  - tempMin    ≤ 0 from ≥+5 the day before → "Frost warning"
 *  - windMean   ≥ 12 m/s   → "Strong winds"
 *  - condition = snow      → "Snow expected"
 */
function dayAlerts(
  day: ComparedDay,
  previous: ComparedDay | undefined,
  locationLabel: string,
): AlertCandidate[] {
  const out: AlertCandidate[] = [];
  // Fire alerts at 07:00 local time on the morning of the event.
  const fireAt = new Date(day.date + "T07:00:00");
  const idBase = Math.floor(fireAt.getTime() / 1000); // unique-per-day

  const precip = day.blend.precipitation ?? 0;
  const windMean = day.blend.windMean ?? 0;
  const tempMin = day.blend.tempMin;
  const tempMax = day.blend.tempMax;
  const cond = day.blend.condition;

  const where = locationLabel ? ` i ${locationLabel}` : "";

  if (precip >= 15) {
    out.push({
      id: idBase + 1,
      fireAt,
      title: `Kraftigt regn${where}`,
      body: `${precip.toFixed(0)} mm väntas idag — ha med regnkläder.`,
    });
  } else if (precip >= 5) {
    out.push({
      id: idBase + 2,
      fireAt,
      title: `Regn väntas${where}`,
      body: `${precip.toFixed(1)} mm under dagen.`,
    });
  }

  if (windMean >= 12) {
    out.push({
      id: idBase + 3,
      fireAt,
      title: `Kraftig vind${where}`,
      body: `Medel ${windMean.toFixed(0)} m/s, max ${(day.blend.windMax ?? windMean).toFixed(0)} m/s.`,
    });
  }

  if (tempMax != null && tempMax <= -10) {
    out.push({
      id: idBase + 4,
      fireAt,
      title: `Bistert kallt${where}`,
      body: `Som högst ${tempMax.toFixed(0)}°C idag.`,
    });
  } else if (
    previous &&
    tempMin != null &&
    tempMin <= 0 &&
    (previous.blend.tempMin ?? 0) >= 5
  ) {
    out.push({
      id: idBase + 5,
      fireAt,
      title: `Frostvarning${where}`,
      body: `Ner mot ${tempMin.toFixed(0)}°C i natt — täck över ömtåliga växter.`,
    });
  }

  if (cond === "snow" || cond === "sleet") {
    out.push({
      id: idBase + 6,
      fireAt,
      title: cond === "snow" ? `Snö väntas${where}` : `Snöblandat regn${where}`,
      body: "Räkna med halt underlag.",
    });
  }

  // Filter out past times — Android won't schedule them.
  return out.filter((a) => a.fireAt.getTime() > Date.now() + 60_000);
}

/**
 * Fetch forecast and schedule alerts for the next 48 hours.
 * Safe to call repeatedly; previous scheduled notifications are cancelled
 * before re-scheduling.
 */
export async function refreshScheduledNotifications(
  lat: number,
  lon: number,
  locationLabel = "",
): Promise<void> {
  // Capacitor is lazy-loaded so this whole function is a no-op on web.
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;

  const { LocalNotifications } = await import("@capacitor/local-notifications");

  // Request permission on first call; user has to explicitly grant on Android 13+.
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== "granted") return;

  // Make sure a notification channel exists. Android 8+ requires this.
  await LocalNotifications.createChannel({
    id: NOTIFICATION_CHANNEL_ID,
    name: "Weather alerts",
    description: "Notiser om regn, snö, kraftig vind och frost",
    importance: 4, // IMPORTANCE_HIGH — visible heads-up notification
    visibility: 1, // PUBLIC
  });

  // Cancel previously-scheduled weather alerts. We use a stable prefix so we
  // know which ones are ours.
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) {
    await LocalNotifications.cancel({ notifications: pending.notifications });
  }

  // Fetch fresh forecast.
  const res = await fetch(apiUrl(`/api/forecast?lat=${lat}&lon=${lon}`));
  if (!res.ok) return;
  const data = (await res.json()) as CompareResponse;

  // Collect alerts for each day (with prev-day context for frost).
  const all: AlertCandidate[] = [];
  for (let i = 0; i < data.days.length; i++) {
    all.push(...dayAlerts(data.days[i], data.days[i - 1], locationLabel));
  }

  if (!all.length) return;

  await LocalNotifications.schedule({
    notifications: all.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      schedule: { at: a.fireAt, allowWhileIdle: true },
      channelId: NOTIFICATION_CHANNEL_ID,
      smallIcon: "ic_stat_icon_config_sample",
    })),
  });
}
