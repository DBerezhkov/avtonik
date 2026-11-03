import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { categoryName, getBusy, getCategories, getCars, getSettings, localizeSettings } from "@/lib/data";
import { absoluteUrl, carCard, carName, ogBase } from "@/lib/format";
import { langFrom, languages, path, t } from "@/lib/i18n";
import { CarCatalog, CarCatalogView, type CatalogCar } from "@/components/CarCatalog";
import { JsonLd } from "@/components/JsonLd";

export async function generateMetadata({ params }: PageProps<"/[lang]/cars">): Promise<Metadata> {
  const lang = await langFrom(params);
  const s = localizeSettings(await getSettings(), lang);
  const title = t(lang).catalog.title(s.city);
  const description = t(lang).catalog.metaDescription(s.site_name);
  return {
    title,
    description,
    // Отфильтрованные варианты (?type=, ?from=) — та же страница для поисковиков
    alternates: { canonical: path(lang, "/cars"), languages: languages("/cars") },
    openGraph: { ...ogBase(s.site_name, lang), title, description, url: path(lang, "/cars") },
  };
}

export default async function CarsPage({ params }: PageProps<"/[lang]/cars">) {
  const lang = await langFrom(params);
  const d = t(lang);
  const [raw, cars, cats, busy] = await Promise.all([getSettings(), getCars(), getCategories("car"), getBusy()]);
  const s = localizeSettings(raw, lang);
  const list: CatalogCar[] = cars.map((c) => ({
    ...carCard(c, s.city, s.currency, lang, categoryName(cats, c.category, lang)),
    categoryOrder: cats.findIndex((x) => x.key === c.category),
    busy: busy[c.id] ?? [],
    prices: { price_per_day: c.price_per_day, price_1_3: c.price_1_3, price_4_7: c.price_4_7, price_8_30: c.price_8_30, price_30_plus: c.price_30_plus },
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        name: d.catalog.title(s.city),
        itemListElement: cars.map((c, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(path(lang, `/cars/${c.slug}`)), name: carName(c) })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: d.breadcrumbs.home, item: absoluteUrl(path(lang, "/")) },
          { "@type": "ListItem", position: 2, name: d.nav.cars, item: absoluteUrl(path(lang, "/cars")) },
        ],
      },
    ],
  };

  return (
    <section className="mx-auto max-w-6xl px-4 pt-10">
      <JsonLd data={jsonLd} />
      <nav aria-label={d.breadcrumbs.aria} className="text-sm text-slate-500">
        <Link href={path(lang, "/")} className="hover:text-brand">{d.breadcrumbs.home}</Link> / <span>{d.nav.cars}</span>
      </nav>
      <h1 className="mt-4 text-3xl font-extrabold md:text-4xl">{d.catalog.title(s.city)}</h1>
      <p className="mt-2 text-slate-600">{d.catalog.lead}</p>
      {/* Фильтр читается из адреса на клиенте; в HTML (и для поисковиков) — полный список без фильтра */}
      <Suspense fallback={<CarCatalogView cars={list} currency={s.currency} lang={lang} cat={null} period={null} />}>
        <CarCatalog cars={list} currency={s.currency} lang={lang} />
      </Suspense>
    </section>
  );
}
