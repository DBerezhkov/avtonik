import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { brandColor, getSettings, localizeSettings } from "@/lib/data";
import { SITE_URL } from "@/lib/format";
import { LOCALES, OG_LOCALE, isLang } from "@/lib/i18n";
import { THEME_SCRIPT, manrope } from "@/lib/fonts";
import "../globals.css";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const s = localizeSettings(await getSettings(), lang);
  const title = `${s.hero_title} — ${s.site_name}`;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s | ${s.site_name}` },
    description: s.hero_subtitle,
    applicationName: s.site_name,
    openGraph: { type: "website", locale: OG_LOCALE[lang], siteName: s.site_name },
    twitter: { card: "summary_large_image" },
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
      yandex: process.env.YANDEX_VERIFICATION || undefined,
    },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  // Цвет темы из админки: всё «оранжевое» на сайте берёт его через --brand; тёмный оттенок — для наведения
  const brand = brandColor(await getSettings());
  return (
    // suppressHydrationWarning: класс .dark ставит скрипт ниже до гидратации
    <html lang={lang} className={`${manrope.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {brand && <style>{`:root{--brand:${brand};--brand-dark:color-mix(in oklab,${brand} 82%,black)}`}</style>}
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
