export type Locale = "en" | "sv";

const translations = {
  en: {
    title: "Veckans Väder",
    tagline: "SMHI, DMI and Open-Meteo blended for your location — with an agreement score per day.",
    subtitle_prefix: "A weekly forecast that blends",
    subtitle_and: "and",
    subtitle_suffix:
      "for your location, with an agreement score so you know how confident the estimate is.",
    sweden: "Sweden",
    denmark: "Denmark",
    global: "global",
    search_placeholder: "Search city (e.g. Stockholm, Copenhagen, Malmö)…",
    my_location: "My location",
    geolocation_unsupported: "Geolocation not supported by this browser.",
    geolocation_prefix: "Geolocation:",
    loading: "Fetching forecasts from SMHI, DMI, and Open-Meteo…",
    subtitle_blend: "7-day blended forecast — SMHI · DMI · Open-Meteo",
    source_weights: "Source weights",
    unavailable: "unavailable",
    avg_temp: "Avg temp",
    precipitation: "Precipitation",
    wind: "Wind",
    cloud: "Cloud",
    high_agreement: "High agreement",
    some_disagreement: "Some disagreement",
    low_agreement: "Low agreement",
    footer_data: "Data ©",
    footer_disclaimer:
      "Forecasts are model output; treat the blended estimate as guidance, not certainty.",
    api_docs: "API docs",
    support_project: "Buy me a coffee",
    support_tagline: "Free forever. Tips keep the lights on.",
    hourly_label: "Hourly forecast",
    close: "Close",
    no_hourly_data: "No hourly data available for this day.",
    visitors_this_week: "visitors this week",
    show_city_weather: "Show weather for {city}",
    all_cities: "All cities",
  },
  sv: {
    title: "Veckans Väder",
    tagline: "SMHI, DMI och Open-Meteo blandade för din plats — med samstämmighetspoäng per dag.",
    subtitle_prefix: "En veckoprognos som blandar",
    subtitle_and: "och",
    subtitle_suffix:
      "för din plats, med en samstämmighetspoäng så att du vet hur säker uppskattningen är.",
    sweden: "Sverige",
    denmark: "Danmark",
    global: "global",
    search_placeholder: "Sök stad (t.ex. Stockholm, Köpenhamn, Malmö)…",
    my_location: "Min plats",
    geolocation_unsupported: "Geolokalisering stöds inte av denna webbläsare.",
    geolocation_prefix: "Geolokalisering:",
    loading: "Hämtar prognoser från SMHI, DMI och Open-Meteo…",
    subtitle_blend: "7-dagarsprognos — SMHI · DMI · Open-Meteo",
    source_weights: "Källvikter",
    unavailable: "ej tillgänglig",
    avg_temp: "Medeltemp",
    precipitation: "Nederbörd",
    wind: "Vind",
    cloud: "Moln",
    high_agreement: "Hög samstämmighet",
    some_disagreement: "Viss avvikelse",
    low_agreement: "Låg samstämmighet",
    footer_data: "Data ©",
    footer_disclaimer:
      "Prognoser är modellberäkningar; behandla den blandade uppskattningen som vägledning, inte säkerhet.",
    api_docs: "API-dokumentation",
    support_project: "Bjud på en kaffe",
    support_tagline: "Gratis för alltid. Tack vare dig som tippar.",
    hourly_label: "Timvis prognos",
    close: "Stäng",
    no_hourly_data: "Ingen timvis data tillgänglig för denna dag.",
    visitors_this_week: "besökare denna vecka",
    show_city_weather: "Visa väder för {city}",
    all_cities: "Alla städer",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["en"];

export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language?.toLowerCase() ?? "";
  if (lang === "sv" || lang.startsWith("sv-")) return "sv";
  return "en";
}

export function t(locale: Locale, key: TranslationKey): string {
  return translations[locale][key];
}
