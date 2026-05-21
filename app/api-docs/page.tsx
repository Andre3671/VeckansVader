"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { useLocale } from "@/components/LocaleProvider";
import type { Locale } from "@/lib/i18n";

const EXAMPLE_RESPONSE = `{
  "location": { "lat": 55.64, "lon": 13.21 },
  "weights": { "smhi": 0.47, "dmi": 0.33, "openmeteo": 0.2 },
  "forecast": [
    {
      "date": "2026-05-14",
      "condition": "partly-cloudy",
      "temperature": { "min": 5.1, "max": 13.3, "mean": 9.2 },
      "precipitation": { "mm": 0.3 },
      "wind": { "mean_ms": 3.3, "max_ms": 4.9 },
      "humidity": 75,
      "cloud_cover": 46,
      "agreement": 0.92,
      "sources": { "smhi": true, "dmi": true, "openmeteo": true }
    }
  ]
}`;

const TEXT: Record<Locale, Record<string, string>> = {
  en: {
    back: "← Back",
    title: "Veckans Väder API",
    intro:
      "A free, public JSON API that returns a blended 7-day forecast from SMHI, DMI, and Open-Meteo, with a per-day agreement score.",
    endpoint: "Endpoint",
    endpoint_desc:
      "Returns a JSON object with the blended forecast and how much the three sources agreed for each day.",
    params: "Query parameters",
    params_note:
      "Provide either place OR both lat and lon. If both are given, lat/lon take precedence.",
    place_desc: "Place name to geocode (e.g. \"Stockholm\", \"Barcelona\").",
    lat_desc: "Latitude in decimal degrees, −90 to 90.",
    lon_desc: "Longitude in decimal degrees, −180 to 180.",
    required_either: "string or use lat+lon",
    required_pair: "number, required if no place",
    example_request: "Example request",
    example_response: "Example response",
    fields: "Response fields",
    location_desc:
      "Coordinates used. Includes a `name` field when resolved via place=.",
    weights_desc:
      "Source weights used to blend, summing to 1. Missing sources renormalise to 0.",
    date_desc: "ISO date (YYYY-MM-DD), UTC.",
    condition_desc:
      "One of: clear, partly-cloudy, cloudy, fog, rain-light, rain, rain-heavy, snow, sleet, thunder, unknown.",
    temperature_desc: "Blended daily temperatures.",
    precipitation_desc: "Total precipitation in millimetres.",
    wind_desc: "Wind speed in m/s, blended mean and daily peak.",
    humidity_desc: "Mean relative humidity for the day, %.",
    cloud_desc: "Mean cloud cover for the day, %.",
    agreement_desc:
      "How much the available sources agreed. 1 = perfect agreement, 0 = strong disagreement, 0.5 = only one source available.",
    sources_desc:
      "Booleans indicating which providers contributed data for this day.",
    rate_limits: "Rate limits",
    rate_limits_desc_pre: "30 requests per minute per IP. Exceeding this returns ",
    rate_limits_desc_mid: " with a ",
    rate_limits_desc_post: " header.",
    sources_title: "Data sources",
    smhi_desc:
      "— SNOW1g (Nordic, high resolution) and ECMWF (global) via the smhi.se backend.",
    dmi_desc:
      "— HARMONIE DINI EDR API plus the dmi.dk NinJo internal API for extended days.",
    openmeteo_desc: "— global forecast aggregator.",
    errors: "Errors",
    err_400: "Missing place and lat/lon, or invalid values.",
    err_404: "place= could not be geocoded.",
    err_429:
      "Rate limit exceeded; retry after the time given in the Retry-After header.",
    err_502:
      "All upstream providers failed. Response body includes per-source details.",
    footer:
      "Forecasts are model output; treat the blended estimate as guidance, not certainty. No SLAs. Be a good citizen and cache responses when you can — upstream providers do rate-limit aggressively if hammered.",
  },
  sv: {
    back: "← Tillbaka",
    title: "Veckans Väder API",
    intro:
      "Ett gratis, publikt JSON-API som returnerar en blandad 7-dagarsprognos från SMHI, DMI och Open-Meteo, med en samstämmighetspoäng per dag.",
    endpoint: "Endpoint",
    endpoint_desc:
      "Returnerar ett JSON-objekt med den blandade prognosen och hur väl de tre källorna stämmer överens för varje dag.",
    params: "Query-parametrar",
    params_note:
      "Skicka antingen place ELLER både lat och lon. Om båda anges har lat/lon företräde.",
    place_desc: "Platsnamn att geokoda (t.ex. \"Stockholm\", \"Barcelona\").",
    lat_desc: "Latitud i decimalgrader, −90 till 90.",
    lon_desc: "Longitud i decimalgrader, −180 till 180.",
    required_either: "sträng eller använd lat+lon",
    required_pair: "tal, krävs om place saknas",
    example_request: "Exempelförfrågan",
    example_response: "Exempelsvar",
    fields: "Svarsfält",
    location_desc:
      "Koordinater som användes. Inkluderar ett `name`-fält när platsen slogs upp via place=.",
    weights_desc:
      "Källvikter som användes vid blandning, summerar till 1. Saknade källor normaliseras till 0.",
    date_desc: "ISO-datum (YYYY-MM-DD), UTC.",
    condition_desc:
      "En av: clear, partly-cloudy, cloudy, fog, rain-light, rain, rain-heavy, snow, sleet, thunder, unknown.",
    temperature_desc: "Blandade dagstemperaturer.",
    precipitation_desc: "Total nederbörd i millimeter.",
    wind_desc: "Vindhastighet i m/s, blandat medel och dagens maxvärde.",
    humidity_desc: "Medelvärde av relativ luftfuktighet för dagen, %.",
    cloud_desc: "Medelvärde av molntäcke för dagen, %.",
    agreement_desc:
      "Hur väl de tillgängliga källorna stämmer överens. 1 = full enighet, 0 = stor oenighet, 0.5 = bara en källa tillgänglig.",
    sources_desc: "Booleska värden som visar vilka källor som bidrog med data.",
    rate_limits: "Anropsgränser",
    rate_limits_desc_pre: "30 förfrågningar per minut per IP. Överskrids detta returneras ",
    rate_limits_desc_mid: " med en ",
    rate_limits_desc_post: "-header.",
    sources_title: "Datakällor",
    smhi_desc:
      "— SNOW1g (Norden, hög upplösning) och ECMWF (global) via smhi.se backend.",
    dmi_desc:
      "— HARMONIE DINI EDR API samt dmi.dk:s interna NinJo-API för utökade dagar.",
    openmeteo_desc: "— global prognosaggregator.",
    errors: "Fel",
    err_400: "Saknar place och lat/lon, eller ogiltiga värden.",
    err_404: "place= kunde inte geokodas.",
    err_429:
      "Anropsgräns överskriden; försök igen efter tiden som anges i Retry-After-headern.",
    err_502: "Alla källor misslyckades. Svaret innehåller detaljer per källa.",
    footer:
      "Prognoser är modellberäkningar; behandla den blandade uppskattningen som vägledning, inte säkerhet. Inga SLA:er. Var en god medborgare och cacha svar när du kan — källorna ratelimitar hårt om de hamras.",
  },
};

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <span className="h-6 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-rose-400" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md bg-slate-200/60 px-1.5 py-0.5 font-mono text-[0.85em] text-indigo-700 dark:bg-slate-800 dark:text-indigo-300">
      {children}
    </code>
  );
}

function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border border-slate-200/60 bg-slate-900 p-5 text-sm leading-relaxed text-slate-100 shadow-lg shadow-slate-200/40 dark:border-slate-700/60 dark:bg-slate-950 dark:shadow-black/30">
      <code className="font-mono">{children}</code>
    </pre>
  );
}

function Field({
  name,
  type,
  desc,
}: {
  name: string;
  type: string;
  desc: string;
}) {
  return (
    <li className="border-b border-slate-200/60 py-3 last:border-0 dark:border-slate-800">
      <div className="flex flex-wrap items-baseline gap-2">
        <Code>{name}</Code>
        <span className="text-xs italic text-slate-500">{type}</span>
      </div>
      <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{desc}</p>
    </li>
  );
}

export default function ApiDocsPage() {
  const locale = useLocale();
  const tx = TEXT[locale];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-12 px-4 py-12">
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1 text-sm text-slate-500 transition hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
        >
          {tx.back}
        </Link>
        <div className="flex items-center gap-4">
          <Logo className="h-14 w-14 shrink-0 rounded-2xl shadow-lg shadow-indigo-500/30 sm:h-16 sm:w-16" />
          <h1 className="bg-gradient-to-br from-indigo-600 via-violet-600 to-rose-500 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
            {tx.title}
          </h1>
        </div>
        <p className="text-base text-slate-600 dark:text-slate-300">{tx.intro}</p>
      </header>

      <Section id="endpoint" title={tx.endpoint}>
        <Pre>
          GET /api/estimate?place={"<name>"}
          {"\n"}
          GET /api/estimate?lat={"<lat>"}&lon={"<lon>"}
        </Pre>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {tx.endpoint_desc}
        </p>
      </Section>

      <Section id="parameters" title={tx.params}>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {tx.params_note}
        </p>
        <ul className="rounded-2xl border border-white/40 bg-white/70 px-5 shadow-lg shadow-slate-200/40 backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/60 dark:shadow-black/30">
          <Field name="place" type={tx.required_either} desc={tx.place_desc} />
          <Field name="lat" type={tx.required_pair} desc={tx.lat_desc} />
          <Field name="lon" type={tx.required_pair} desc={tx.lon_desc} />
        </ul>
      </Section>

      <Section id="example" title={tx.example_request}>
        <Pre>
          curl &quot;https://veckansvader.se/api/estimate?place=Stockholm&quot;
          {"\n"}
          curl &quot;https://veckansvader.se/api/estimate?lat=55.64&amp;lon=13.21&quot;
        </Pre>
      </Section>

      <Section id="response" title={tx.example_response}>
        <Pre>{EXAMPLE_RESPONSE}</Pre>
      </Section>

      <Section id="fields" title={tx.fields}>
        <ul className="rounded-2xl border border-white/40 bg-white/70 px-5 shadow-lg shadow-slate-200/40 backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/60 dark:shadow-black/30">
          <Field
            name="location"
            type="{ lat, lon, name? }"
            desc={tx.location_desc}
          />
          <Field
            name="weights"
            type="{ smhi, dmi, openmeteo }"
            desc={tx.weights_desc}
          />
          <Field name="forecast[].date" type="string" desc={tx.date_desc} />
          <Field
            name="forecast[].condition"
            type="string"
            desc={tx.condition_desc}
          />
          <Field
            name="forecast[].temperature"
            type="{ min, max, mean } °C"
            desc={tx.temperature_desc}
          />
          <Field
            name="forecast[].precipitation.mm"
            type="number"
            desc={tx.precipitation_desc}
          />
          <Field
            name="forecast[].wind"
            type="{ mean_ms, max_ms }"
            desc={tx.wind_desc}
          />
          <Field
            name="forecast[].humidity"
            type="number"
            desc={tx.humidity_desc}
          />
          <Field
            name="forecast[].cloud_cover"
            type="number"
            desc={tx.cloud_desc}
          />
          <Field
            name="forecast[].agreement"
            type="number, 0–1"
            desc={tx.agreement_desc}
          />
          <Field
            name="forecast[].sources"
            type="{ smhi, dmi, openmeteo }"
            desc={tx.sources_desc}
          />
        </ul>
      </Section>

      <Section id="rate-limits" title={tx.rate_limits}>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {tx.rate_limits_desc_pre}
          <Code>429 Too Many Requests</Code>
          {tx.rate_limits_desc_mid}
          <Code>Retry-After</Code>
          {tx.rate_limits_desc_post}
        </p>
      </Section>

      <Section id="data-sources" title={tx.sources_title}>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-600 dark:text-slate-400">
          <li>
            <a className="underline" href="https://opendata.smhi.se">
              SMHI
            </a>{" "}
            {tx.smhi_desc}
          </li>
          <li>
            <a className="underline" href="https://www.dmi.dk/friedata">
              DMI
            </a>{" "}
            {tx.dmi_desc}
          </li>
          <li>
            <a className="underline" href="https://open-meteo.com">
              Open-Meteo
            </a>{" "}
            {tx.openmeteo_desc}
          </li>
        </ul>
      </Section>

      <Section id="errors" title={tx.errors}>
        <ul className="rounded-2xl border border-white/40 bg-white/70 px-5 shadow-lg shadow-slate-200/40 backdrop-blur dark:border-slate-700/40 dark:bg-slate-900/60 dark:shadow-black/30">
          <Field name="400" type="Bad Request" desc={tx.err_400} />
          <Field name="404" type="Not Found" desc={tx.err_404} />
          <Field name="429" type="Too Many Requests" desc={tx.err_429} />
          <Field name="502" type="Bad Gateway" desc={tx.err_502} />
        </ul>
      </Section>

      <footer className="border-t border-slate-200 pt-6 text-xs text-slate-500 dark:border-slate-800">
        {tx.footer}
      </footer>
    </main>
  );
}
