import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { categoryName, getCategories, getSettings, getSightBySlug, getSights, localizeSettings, localizeSight } from "@/lib/data";
import { SIGHT_CARS, absoluteUrl, imageUrl, label, mapsUrl, ogBase, snippet } from "@/lib/format";
import { LOCALES, isLang, languages, path, t, type Lang } from "@/lib/i18n";
import { JsonLd } from "@/components/JsonLd";
import { Photo } from "@/components/Photo";

export async function generateStaticParams() {
  const sights = await getSights();
  return LOCALES.flatMap((lang) => sights.map((x) => ({ lang, slug: x.slug })));
}

async function load(params: Promise<{ lang: string; slug: string }>) {
  const { lang: raw, slug } = await params;
  const lang: Lang = isLang(raw) ? raw : "en";
  const [sight, s, cats] = await Promise.all([getSightBySlug(slug), getSettings(), getCategories("sight")]);
  return { lang, sight: sight && localizeSight(sight, lang), s: localizeSettings(s, lang), cats };
}

/** Все фото места по порядку (первое — главное). */
const photosOf = (x: { images: { file: string }[] }) => x.images.map((i) => imageUrl(i.file)!);

export async function generateMetadata({ params }: PageProps<"/[lang]/sights/[slug]">): Promise<Metadata> {
  const { lang, sight, s } = await load(params);
  const d = t(lang);
  if (!sight) return { title: d.sight.notFound, robots: { index: false } };

  const title = d.sight.metaTitle(sight.name, s.city);
  const description = snippet(sight.description || `${sight.name}${sight.region ? `, ${sight.region}` : ""}`);
  const p = `/sights/${sight.slug}`;
  return {
    title,
    description,
    alternates: { canonical: path(lang, p), languages: languages(p) },
    openGraph: { ...ogBase(s.site_name, lang), title, description, url: path(lang, p), images: photosOf(sight).map((url) => ({ url, alt: sight.name })) },
  };
}

export default function SightPage(props: PageProps<"/[lang]/sights/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-16 text-slate-500" aria-busy="true">…</div>}>
      <SightDetails params={props.params} />
    </Suspense>
  );
}

// Несуществующий slug отсекается раньше, в proxy.ts (честный HTTP 404); notFound() — страховка.
async function SightDetails({ params }: Pick<PageProps<"/[lang]/sights/[slug]">, "params">) {
  const { lang, sight, s, cats } = await load(params);
  if (!sight) notFound();
  const d = t(lang);

  const url = absoluteUrl(path(lang, `/sights/${sight.slug}`));
  const photos = photosOf(sight);
  const maps = mapsUrl(sight);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TouristAttraction",
        "@id": url,
        name: sight.name,
        description: sight.description || undefined,
        url,
        image: photos.map((p) => absoluteUrl(p)),
        hasMap: maps,
        address: { "@type": "PostalAddress", addressLocality: sight.region || undefined, addressCountry: "GE" },
        geo: sight.lat != null && sight.lng != null ? { "@type": "GeoCoordinates", latitude: sight.lat, longitude: sight.lng } : undefined,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: d.breadcrumbs.home, item: absoluteUrl(path(lang, "/")) },
          { "@type": "ListItem", position: 2, name: d.sights.crumb, item: absoluteUrl(path(lang, "/sights")) },
          { "@type": "ListItem", position: 3, name: sight.name, item: url },
        ],
      },
    ],
  };

  return (
    <article className="mx-auto max-w-6xl px-4 py-8">
      <JsonLd data={jsonLd} />

      <nav aria-label={d.breadcrumbs.aria} className="text-sm text-slate-500">
        <ol className="flex flex-wrap gap-2">
          <li><Link href={path(lang, "/")} className="hover:text-brand">{d.breadcrumbs.home}</Link> /</li>
          <li><Link href={path(lang, "/sights")} className="hover:text-brand">{d.sights.crumb}</Link> /</li>
          <li aria-current="page" className="text-slate-800">{sight.name}</li>
        </ol>
      </nav>

      <h1 className="mt-4 text-3xl font-extrabold md:text-4xl">{sight.name}</h1>
      {sight.region && <p className="mt-1 text-slate-600">{sight.region}</p>}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div>
          {photos.length > 0 && (
            <div className="grid gap-3">
              <div className="relative aspect-[3/2] overflow-hidden rounded-2xl bg-slate-200">
                <Photo src={photos[0]} alt={d.sight.photo(sight.name, 1)} fill priority sizes="(min-width: 1024px) 760px, 100vw" className="object-cover" />
              </div>
              {photos.length > 1 && (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {photos.slice(1).map((src, i) => (
                    <a key={src} href={src} target="_blank" className="relative aspect-[3/2] overflow-hidden rounded-xl bg-slate-200">
                      <Photo src={src} alt={d.sight.photo(sight.name, i + 2)} fill sizes="200px" className="object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {sight.description && (
            <section className="mt-10">
              <h2 className="text-2xl font-bold">{d.sight.about}</h2>
              <p className="mt-3 whitespace-pre-line leading-7 text-slate-700">{sight.description}</p>
            </section>
          )}
        </div>

        <aside className="h-fit rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-24">
          <dl className="space-y-2 text-sm">
            {sight.region && <div className="flex justify-between gap-4"><dt className="text-slate-500">{d.sight.region}</dt><dd className="text-right font-semibold">{sight.region}</dd></div>}
            {sight.distance_km != null && (
              <div className="flex justify-between gap-4"><dt className="text-slate-500">{d.sight.distance}</dt>
                <dd className="text-right font-semibold">{d.sight.km(sight.distance_km)}{sight.drive_min != null && <span className="font-normal text-slate-500"> · {d.sight.time(sight.drive_min)}</span>}</dd></div>
            )}
            <div className="flex justify-between gap-4"><dt className="text-slate-500">{d.sight.car}</dt><dd className="text-right font-semibold">{label(SIGHT_CARS, sight.car_type, lang)}</dd></div>
            {sight.category && <div className="flex justify-between gap-4"><dt className="text-slate-500">{d.sight.route}</dt><dd className="text-right font-semibold">{categoryName(cats, sight.category, lang)}</dd></div>}
          </dl>
          <p className="mt-5 font-bold">{d.sight.howToGet}</p>
          <p className="mt-1 text-sm text-slate-600">{d.sight.howToGetText(s.city)}</p>
          <a href={maps} target="_blank" rel="noopener noreferrer"
            className="mt-4 block rounded-full border border-slate-300 px-6 py-3 text-center font-semibold hover:border-brand hover:text-brand">
            {d.sights.maps}
          </a>
          {/* Кроссовер или 4×4 — сразу каталог с фильтром по классу SUV */}
          <Link href={path(lang, sight.car_type === "any" ? "/cars" : "/cars?type=suv")} className="mt-3 block rounded-full bg-brand px-6 py-3 text-center font-bold text-white hover:bg-brand-dark">
            {d.sight.rentCar}
          </Link>
        </aside>
      </div>
    </article>
  );
}
