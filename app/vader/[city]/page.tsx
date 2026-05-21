import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WeatherPage } from "@/components/WeatherPage";
import { fetchSmhi } from "@/lib/smhi";
import { fetchDmi } from "@/lib/dmi";
import { fetchOpenMeteo } from "@/lib/openmeteo";
import { compareForecasts } from "@/lib/compare";
import { CITIES, getCityBySlug } from "@/lib/cities";
import type { CompareResponse } from "@/lib/types";

// Re-render at most every 30 min per city — fresh enough for a weekly
// forecast, light enough to not hammer upstream APIs even at crawl-time.
export const revalidate = 1800;

// Pre-build only the most popular cities at deploy time. The rest are
// rendered on first request and then cached for `revalidate` seconds —
// avoids 42 × ~3-API-calls during `next build` (which was timing out
// individual pages at 60s when upstreams were slow).
export function generateStaticParams() {
  const topSlugs = new Set([
    "stockholm", "goteborg", "malmo", "uppsala",
    "kobenhavn", "aarhus", "oslo", "helsinki",
  ]);
  return CITIES.filter((c) => topSlugs.has(c.slug)).map((c) => ({ city: c.slug }));
}

// Allow on-demand rendering for slugs not pre-generated above.
export const dynamicParams = true;

// ── Per-city metadata ───────────────────────────────────────────────────
export async function generateMetadata(props: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city: slug } = await props.params;
  const city = getCityBySlug(slug);
  if (!city) return { title: "Veckans Väder" };

  // No "| Veckans Väder" suffix — the root layout's metadata template
  // ("%s | Veckans Väder") appends it automatically.
  const title = `Väder ${city.name} — 7-dagarsprognos`;
  const description =
    `Veckoprognos för ${city.name}, ${city.countryName}. ` +
    `Kombinerar SMHI, DMI och Open-Meteo med samstämmighetspoäng per dag. ` +
    `Temperatur, regn, vind, moln.`;
  const url = `https://veckansvader.se/vader/${city.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Veckans Väder",
      locale: city.country === "DK" ? "da_DK" : city.country === "NO" ? "nb_NO" : "sv_SE",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    keywords: [
      `väder ${city.name}`,
      `${city.name} väder`,
      `prognos ${city.name}`,
      `7-dagarsprognos ${city.name}`,
      "SMHI",
      "DMI",
      "Open-Meteo",
      "veckoprognos",
    ],
  };
}

// ── Page component ──────────────────────────────────────────────────────
export default async function CityPage(props: {
  params: Promise<{ city: string }>;
}) {
  const { city: slug } = await props.params;
  const city = getCityBySlug(slug);
  if (!city) notFound();

  // Fetch all three providers in parallel server-side.
  const [smhiRes, dmiRes, omRes] = await Promise.allSettled([
    fetchSmhi(city.lat, city.lon),
    fetchDmi(city.lat, city.lon),
    fetchOpenMeteo(city.lat, city.lon),
  ]);

  const smhi = smhiRes.status === "fulfilled" ? smhiRes.value : null;
  const dmi = dmiRes.status === "fulfilled" ? dmiRes.value : null;
  const openmeteo = omRes.status === "fulfilled" ? omRes.value : null;
  const errors: { smhi?: string; dmi?: string; openmeteo?: string } = {};
  if (smhiRes.status === "rejected") errors.smhi = String(smhiRes.reason?.message ?? smhiRes.reason);
  if (dmiRes.status === "rejected") errors.dmi = String(dmiRes.reason?.message ?? dmiRes.reason);
  if (omRes.status === "rejected") errors.openmeteo = String(omRes.reason?.message ?? omRes.reason);

  const locationLabel = `${city.name}, ${city.countryName}`;
  const compared: CompareResponse = compareForecasts(
    city.lat,
    city.lon,
    smhi,
    dmi,
    openmeteo,
    errors,
    locationLabel,
  );

  // JSON-LD structured data so Google can render rich results.
  const jsonLd = buildJsonLd(city, compared, locationLabel);

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <WeatherPage
        initialData={compared}
        initialLocation={{ lat: city.lat, lon: city.lon, label: locationLabel }}
        hideAutoLocate
      />
    </>
  );
}

function buildJsonLd(
  city: ReturnType<typeof getCityBySlug>,
  data: CompareResponse,
  locationLabel: string,
) {
  if (!city) return null;
  // schema.org doesn't have a perfect "weather forecast" type. We use
  // a WebPage with a Place sub-entity plus a list of day observations.
  const today = data.days[0];
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `Väder ${city.name}`,
    description: `7-dagarsprognos för ${locationLabel}`,
    url: `https://veckansvader.se/vader/${city.slug}`,
    inLanguage: city.country === "DK" ? "da-DK" : city.country === "NO" ? "nb-NO" : "sv-SE",
    about: {
      "@type": "Place",
      name: locationLabel,
      address: {
        "@type": "PostalAddress",
        addressLocality: city.name,
        addressRegion: city.region,
        addressCountry: city.country,
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: city.lat,
        longitude: city.lon,
      },
    },
    mainEntity: today
      ? {
          "@type": "Observation",
          observationDate: today.date,
          measuredProperty: "Temperature",
          measuredValue: today.blend.tempMean,
          unitText: "°C",
        }
      : undefined,
  };
}
