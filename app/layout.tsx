import type { Metadata } from "next";
import { LocaleProvider } from "@/components/LocaleProvider";
import { TimeOfDayBackground } from "@/components/TimeOfDayBackground";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://veckansvader.se"),
  title: {
    default: "Veckans Väder — 7-dagarsprognos från SMHI, DMI och Open-Meteo",
    template: "%s | Veckans Väder",
  },
  description:
    "Veckoprognos som blandar SMHI, DMI och Open-Meteo till en samlad uppskattning för din plats. Med samstämmighetspoäng per dag så du vet hur säker prognosen är.",
  applicationName: "Veckans Väder",
  authors: [{ name: "André Roygaard" }],
  generator: "Next.js",
  keywords: [
    "väder",
    "veckoprognos",
    "7-dagarsprognos",
    "SMHI",
    "DMI",
    "Open-Meteo",
    "väderprognos",
    "regn",
    "snö",
    "temperatur",
    "Sverige",
    "Danmark",
    "Norge",
  ],
  alternates: {
    canonical: "https://veckansvader.se",
  },
  openGraph: {
    title: "Veckans Väder — blandar SMHI, DMI och Open-Meteo",
    description:
      "En enda samlad veckoprognos baserad på tre källor, med samstämmighetspoäng per dag.",
    url: "https://veckansvader.se",
    siteName: "Veckans Väder",
    locale: "sv_SE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Veckans Väder",
    description:
      "Veckoprognos som blandar SMHI, DMI och Open-Meteo med samstämmighetspoäng per dag.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv">
      <body className="min-h-screen">
        <TimeOfDayBackground />
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
