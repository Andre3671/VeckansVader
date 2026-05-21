import type { WeatherCondition } from "@/lib/types";

const ICONS: Record<WeatherCondition, string> = {
  clear: "☀️",
  "partly-cloudy": "⛅",
  cloudy: "☁️",
  fog: "🌫️",
  "rain-light": "🌦️",
  rain: "🌧️",
  "rain-heavy": "⛈️",
  snow: "❄️",
  sleet: "🌨️",
  thunder: "⛈️",
  unknown: "❔",
};

export function WeatherIcon({
  condition,
  size = "text-3xl",
}: {
  condition: WeatherCondition;
  size?: string;
}) {
  return (
    <span className={size} aria-label={condition}>
      {ICONS[condition]}
    </span>
  );
}
