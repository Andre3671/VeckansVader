# WeatherCompare

A small Next.js site that fetches the weekly forecast for your location from
**SMHI** (Sweden) and **DMI** (Denmark) in parallel, shows them side-by-side,
and produces a **blended estimate** weighted by how close you are to each
country, plus an **agreement score** that tells you how confident the blend is.

- Location: browser geolocation **or** city search (Open-Meteo geocoding, no key)
- SMHI: free open API (SNOW1g), no key required
- DMI: free open API (Forecast EDR), no key required

## Quick start

```bash
npm install
npm run dev
# → open http://localhost:3000
```

No API keys needed — both SMHI and DMI are fully open access.

## Project structure

```
app/
  page.tsx                # main UI
  layout.tsx
  globals.css
  api/
    forecast/route.ts     # combines SMHI + DMI for given lat/lon
    geocode/route.ts      # city search proxy (Open-Meteo)
components/
  LocationPicker.tsx
  ComparisonView.tsx
  WeatherIcon.tsx
lib/
  smhi.ts                 # SMHI fetch + normalize
  dmi.ts                  # DMI fetch + normalize
  aggregate.ts            # hourly → daily summaries
  compare.ts              # blend two forecasts + agreement score
  geo.ts                  # haversine + provider weighting
  types.ts                # shared types
```

## How the blend works

For a location at `(lat, lon)` we compute the great-circle distance to
representative points in Sweden and Denmark, then weight each provider by
inverse distance with a 50 km smoothing constant:

```
w_smhi = 1 / (dist_to_SE + 50)
w_dmi  = 1 / (dist_to_DK + 50)
# normalised so they sum to 1
```

So Stockholm is ~95% SMHI, Copenhagen is ~95% DMI, the Øresund area sits in
between, and locations far from both end up ~50/50.

Each daily metric is a weighted average. The **agreement score** is `1` minus
the normalised disagreement across temperature, precipitation, wind, and cloud
metrics. A red/amber/green badge flags when the two sources diverge.

## Notes / limitations

- DMI's `total-precipitation` field is accumulated; we difference consecutive
  hours to get per-hour amounts.
- SMHI cloud cover comes as `cloud_area_fraction` in oktas (0–8); we rescale to percent.
- Daily summaries bucket by UTC date — fine for an overview, off by a few
  hours at day boundaries depending on local timezone.
- This is informational only — for safety-critical decisions use the
  providers' official sites.
