/**
 * Static catalogue of Nordic cities for SEO landing pages.
 *
 * Each entry powers an SSR route at /vader/<slug> and an entry in the
 * sitemap. Coords are accurate enough for the providers' point forecasts.
 *
 * Slugs are kept ASCII (no å/ä/ö) so they're stable in URLs and Google's
 * cache. The display name (`name`) keeps proper Swedish/Danish spelling.
 */

export interface City {
  slug: string;
  name: string;
  country: "SE" | "DK" | "NO" | "FI";
  countryName: string;
  region?: string;
  lat: number;
  lon: number;
}

export const CITIES: City[] = [
  // ── Sweden ────────────────────────────────────────────────────────────
  { slug: "stockholm",    name: "Stockholm",     country: "SE", countryName: "Sverige", region: "Stockholms län",     lat: 59.3293, lon: 18.0686 },
  { slug: "goteborg",     name: "Göteborg",      country: "SE", countryName: "Sverige", region: "Västra Götaland",    lat: 57.7089, lon: 11.9746 },
  { slug: "malmo",        name: "Malmö",         country: "SE", countryName: "Sverige", region: "Skåne",              lat: 55.6050, lon: 13.0038 },
  { slug: "uppsala",      name: "Uppsala",       country: "SE", countryName: "Sverige", region: "Uppsala län",        lat: 59.8586, lon: 17.6389 },
  { slug: "linkoping",    name: "Linköping",     country: "SE", countryName: "Sverige", region: "Östergötland",       lat: 58.4108, lon: 15.6214 },
  { slug: "vasteras",     name: "Västerås",      country: "SE", countryName: "Sverige", region: "Västmanland",        lat: 59.6099, lon: 16.5448 },
  { slug: "orebro",       name: "Örebro",        country: "SE", countryName: "Sverige", region: "Örebro län",         lat: 59.2741, lon: 15.2066 },
  { slug: "helsingborg",  name: "Helsingborg",   country: "SE", countryName: "Sverige", region: "Skåne",              lat: 56.0465, lon: 12.6945 },
  { slug: "norrkoping",   name: "Norrköping",    country: "SE", countryName: "Sverige", region: "Östergötland",       lat: 58.5877, lon: 16.1924 },
  { slug: "jonkoping",    name: "Jönköping",     country: "SE", countryName: "Sverige", region: "Småland",            lat: 57.7826, lon: 14.1618 },
  { slug: "lund",         name: "Lund",          country: "SE", countryName: "Sverige", region: "Skåne",              lat: 55.7047, lon: 13.1910 },
  { slug: "umea",         name: "Umeå",          country: "SE", countryName: "Sverige", region: "Västerbotten",       lat: 63.8258, lon: 20.2630 },
  { slug: "gavle",        name: "Gävle",         country: "SE", countryName: "Sverige", region: "Gävleborg",          lat: 60.6749, lon: 17.1413 },
  { slug: "boras",        name: "Borås",         country: "SE", countryName: "Sverige", region: "Västra Götaland",    lat: 57.7210, lon: 12.9401 },
  { slug: "eskilstuna",   name: "Eskilstuna",    country: "SE", countryName: "Sverige", region: "Södermanland",       lat: 59.3666, lon: 16.5077 },
  { slug: "halmstad",     name: "Halmstad",      country: "SE", countryName: "Sverige", region: "Halland",            lat: 56.6745, lon: 12.8578 },
  { slug: "sundsvall",    name: "Sundsvall",     country: "SE", countryName: "Sverige", region: "Västernorrland",     lat: 62.3908, lon: 17.3069 },
  { slug: "karlstad",     name: "Karlstad",      country: "SE", countryName: "Sverige", region: "Värmland",           lat: 59.4022, lon: 13.5115 },
  { slug: "vaxjo",        name: "Växjö",         country: "SE", countryName: "Sverige", region: "Småland",            lat: 56.8777, lon: 14.8094 },
  { slug: "lulea",        name: "Luleå",         country: "SE", countryName: "Sverige", region: "Norrbotten",         lat: 65.5848, lon: 22.1567 },
  { slug: "ostersund",    name: "Östersund",     country: "SE", countryName: "Sverige", region: "Jämtland",           lat: 63.1792, lon: 14.6357 },
  { slug: "kiruna",       name: "Kiruna",        country: "SE", countryName: "Sverige", region: "Norrbotten",         lat: 67.8558, lon: 20.2253 },
  { slug: "visby",        name: "Visby",         country: "SE", countryName: "Sverige", region: "Gotland",            lat: 57.6348, lon: 18.2948 },
  { slug: "kalmar",       name: "Kalmar",        country: "SE", countryName: "Sverige", region: "Småland",            lat: 56.6616, lon: 16.3616 },
  { slug: "karlskrona",   name: "Karlskrona",    country: "SE", countryName: "Sverige", region: "Blekinge",           lat: 56.1612, lon: 15.5869 },

  // ── Denmark ───────────────────────────────────────────────────────────
  { slug: "kobenhavn",    name: "København",     country: "DK", countryName: "Danmark", region: "Hovedstaden",        lat: 55.6761, lon: 12.5683 },
  { slug: "aarhus",       name: "Aarhus",        country: "DK", countryName: "Danmark", region: "Midtjylland",        lat: 56.1629, lon: 10.2039 },
  { slug: "odense",       name: "Odense",        country: "DK", countryName: "Danmark", region: "Syddanmark",         lat: 55.4038, lon: 10.4024 },
  { slug: "aalborg",      name: "Aalborg",       country: "DK", countryName: "Danmark", region: "Nordjylland",        lat: 57.0488, lon: 9.9217  },
  { slug: "esbjerg",      name: "Esbjerg",       country: "DK", countryName: "Danmark", region: "Syddanmark",         lat: 55.4761, lon: 8.4592  },
  { slug: "randers",      name: "Randers",       country: "DK", countryName: "Danmark", region: "Midtjylland",        lat: 56.4607, lon: 10.0364 },
  { slug: "kolding",      name: "Kolding",       country: "DK", countryName: "Danmark", region: "Syddanmark",         lat: 55.4904, lon: 9.4720  },
  { slug: "vejle",        name: "Vejle",         country: "DK", countryName: "Danmark", region: "Syddanmark",         lat: 55.7090, lon: 9.5358  },
  { slug: "horsens",      name: "Horsens",       country: "DK", countryName: "Danmark", region: "Midtjylland",        lat: 55.8607, lon: 9.8503  },

  // ── Norway ────────────────────────────────────────────────────────────
  { slug: "oslo",         name: "Oslo",          country: "NO", countryName: "Norge",   region: "Oslo",               lat: 59.9139, lon: 10.7522 },
  { slug: "bergen",       name: "Bergen",        country: "NO", countryName: "Norge",   region: "Vestland",           lat: 60.3913, lon: 5.3221  },
  { slug: "trondheim",    name: "Trondheim",     country: "NO", countryName: "Norge",   region: "Trøndelag",          lat: 63.4305, lon: 10.3951 },
  { slug: "stavanger",    name: "Stavanger",     country: "NO", countryName: "Norge",   region: "Rogaland",           lat: 58.9700, lon: 5.7331  },
  { slug: "tromso",       name: "Tromsø",        country: "NO", countryName: "Norge",   region: "Troms og Finnmark",  lat: 69.6492, lon: 18.9553 },

  // ── Finland ───────────────────────────────────────────────────────────
  { slug: "helsinki",     name: "Helsinki",      country: "FI", countryName: "Finland", region: "Uusimaa",            lat: 60.1699, lon: 24.9384 },
  { slug: "turku",        name: "Turku",         country: "FI", countryName: "Finland", region: "Egentliga Finland",  lat: 60.4518, lon: 22.2666 },
  { slug: "tampere",      name: "Tampere",       country: "FI", countryName: "Finland", region: "Birkaland",          lat: 61.4978, lon: 23.7610 },
];

export function getCityBySlug(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}

/**
 * Best-effort: produce a slug from a place name. Used to suggest a city
 * landing page from a reverse-geocoded location.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Find a city by name (case-insensitive, accent-insensitive). Returns
 * undefined when the place isn't in our curated list (e.g. small village
 * or international city).
 */
export function findCityByName(name: string): City | undefined {
  const slug = slugify(name);
  return CITIES.find(
    (c) => c.slug === slug || slugify(c.name) === slug,
  );
}

/**
 * Find the city closest to a lat/lon. Used by the homepage to suggest
 * "Visa väder för Stockholm" when the user's geolocation lands near a
 * known city.
 *
 * Returns the nearest city and the great-circle distance in km. The caller
 * should ignore the suggestion if `km` is unreasonably large (e.g. > 50).
 */
export function nearestCity(
  lat: number,
  lon: number,
): { city: City; km: number } {
  let best: City = CITIES[0];
  let bestKm = haversineKm(lat, lon, best.lat, best.lon);
  for (let i = 1; i < CITIES.length; i++) {
    const d = haversineKm(lat, lon, CITIES[i].lat, CITIES[i].lon);
    if (d < bestKm) {
      best = CITIES[i];
      bestKm = d;
    }
  }
  return { city: best, km: bestKm };
}

function haversineKm(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(la2 - la1);
  const dLon = toRad(lo2 - lo1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
