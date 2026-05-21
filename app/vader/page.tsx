import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { CITIES, type City } from "@/lib/cities";

export const metadata: Metadata = {
  title: "Alla städer — Veckans Väder",
  description:
    "Veckoprognoser för städer i Sverige, Danmark, Norge och Finland. Blandar SMHI, DMI och Open-Meteo till en samlad uppskattning med samstämmighetspoäng per dag.",
  alternates: { canonical: "https://veckansvader.se/vader" },
  openGraph: {
    title: "Alla städer — Veckans Väder",
    description:
      "Veckoprognoser för städer i Sverige, Danmark, Norge och Finland.",
    url: "https://veckansvader.se/vader",
    siteName: "Veckans Väder",
    locale: "sv_SE",
    type: "website",
  },
};

const COUNTRIES: { code: City["country"]; name: string; flag: string }[] = [
  { code: "SE", name: "Sverige",  flag: "🇸🇪" },
  { code: "DK", name: "Danmark",  flag: "🇩🇰" },
  { code: "NO", name: "Norge",    flag: "🇳🇴" },
  { code: "FI", name: "Finland",  flag: "🇫🇮" },
];

export default function CitiesIndexPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-12">
      <header className="flex items-center gap-4 sm:gap-5">
        <Link href="/" aria-label="Veckans Väder">
          <Logo className="h-14 w-14 shrink-0 rounded-2xl shadow-lg shadow-indigo-500/30 sm:h-16 sm:w-16" />
        </Link>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="bg-gradient-to-br from-indigo-600 via-violet-600 to-rose-500 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
            Alla städer
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            Veckoprognoser för {CITIES.length} städer i Norden
          </p>
        </div>
      </header>

      {COUNTRIES.map((country) => {
        const list = CITIES.filter((c) => c.country === country.code).sort(
          (a, b) => a.name.localeCompare(b.name, "sv"),
        );
        if (!list.length) return null;
        return (
          <section key={country.code} className="flex flex-col gap-4">
            <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <span className="text-2xl">{country.flag}</span>
              {country.name}
              <span className="text-sm font-normal text-slate-500">
                ({list.length})
              </span>
            </h2>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/vader/${c.slug}`}
                    className="block rounded-2xl border border-white/40 bg-white/70 px-4 py-3 text-sm shadow-sm backdrop-blur transition hover:bg-white hover:shadow-md dark:border-slate-700/40 dark:bg-slate-900/60 dark:hover:bg-slate-900"
                  >
                    <div className="font-semibold tracking-tight">{c.name}</div>
                    {c.region && (
                      <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                        {c.region}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <footer className="border-t border-slate-200/60 pt-6 text-xs text-slate-500 dark:border-slate-800">
        Saknar du en stad? Skriv in den i sökrutan på{" "}
        <Link href="/" className="underline">startsidan</Link> så får du prognosen
        ändå — listan ovan är bara dedikerade landningssidor för de mest sökta.
      </footer>
    </main>
  );
}
