import Link from "next/link";
import type { Metadata } from "next";
import { categoryName, getCategories, getSettings, getSights, localizeSettings, localizeSight } from "@/lib/data";
import { SIGHT_CARS, absoluteUrl, imageUrl, label, mapsUrl, ogBase } from "@/lib/format";
import { langFrom, languages, path, t } from "@/lib/i18n";
import { JsonLd } from "@/components/JsonLd";
import { SightGrid } from "@/components/SightGrid";

export async function generateMetadata({ params }: PageProps<"/[lang]/sights">): Promise<Metadata> {
  const lang = await langFrom(params);
  const s = localizeSettings(await getSettings(), lang);
  const title = t(lang).sights.title(s.city);
  const description = t(lang).sights.metaDescription;
  return {
    title,
    description,
    alternates: { canonical: path(lang, "/sights"), languages: languages("/sights") },
    openGraph: { ...ogBase(s.site_name, lang), title, description, url: path(lang, "/sights") },
  };
}

export default async function SightsPage({ params }: PageProps<"/[lang]/sights">) {
  const lang = await langFrom(params);
  const d = t(lang);
  const [raw, rawSights, cats] = await Promise.all([getSettings(), getSights(), getCategories("sight")]);
  const s = localizeSettings(raw, lang);
  const sights = rawSights.map((x) => localizeSight(x, lang));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        name: d.home.sightsTitle(s.city),
        itemListElement: sights.map((x, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "TouristAttraction",
            name: x.name,
            url: absoluteUrl(path(lang, `/sights/${x.slug}`)),
            description: x.description || undefined,
            image: x.image ? absoluteUrl(imageUrl(x.image)!) : undefined,
            hasMap: mapsUrl(x),
            address: { "@type": "PostalAddress", addressLocality: x.region || undefined, addressCountry: "GE" },
            geo: x.lat != null && x.lng != null ? { "@type": "GeoCoordinates", latitude: x.lat, longitude: x.lng } : undefined,
          },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: d.breadcrumbs.home, item: absoluteUrl(path(lang, "/")) },
          { "@type": "ListItem", position: 2, name: d.sights.crumb, item: absoluteUrl(path(lang, "/sights")) },
        ],
      },
    ],
  };

  return (
    <section className="mx-auto max-w-6xl px-4 pt-10">
      <JsonLd data={jsonLd} />
      <nav aria-label={d.breadcrumbs.aria} className="text-sm text-slate-500">
        <Link href={path(lang, "/")} className="hover:text-brand">{d.breadcrumbs.home}</Link> / <span>{d.sights.crumb}</span>
      </nav>
      <h1 className="mt-4 text-3xl font-extrabold md:text-4xl">{d.sights.title(s.city)}</h1>
      <p className="mt-2 max-w-3xl text-slate-600">{d.sights.lead}</p>
      <SightGrid
        lang={lang}
        order={cats.map((c) => c.key)}
        sights={sights.map((x) => ({
          id: x.id, name: x.name, region: x.region, category: x.category, categoryLabel: categoryName(cats, x.category, lang), description: x.description, image: imageUrl(x.image), distanceKm: x.distance_km, carType: label(SIGHT_CARS, x.car_type, lang), slug: x.slug, mapsHref: mapsUrl(x),
        }))}
      />
    </section>
  );
}
