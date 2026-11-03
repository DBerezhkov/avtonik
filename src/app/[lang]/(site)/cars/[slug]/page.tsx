import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { categoryName, getCategories, getCarBySlug, getCars, getSettings, localizeCar, localizeSettings } from "@/lib/data";
import {
  FUELS, TRANSMISSIONS, absoluteUrl, carName, formatPrice, imageUrl, label, minPrice, ogBase, priceTiers, snippet,
  parsePickupPoints, pickupsFor, telegramUrl, whatsappUrl,
} from "@/lib/format";
import { LOCALES, isLang, languages, path, t, valueIn, type Lang } from "@/lib/i18n";
import { BookingForm, BookingFormFromUrl } from "@/components/BookingForm";
import { JsonLd } from "@/components/JsonLd";
import { Photo } from "@/components/Photo";

export async function generateStaticParams() {
  const cars = await getCars();
  return LOCALES.flatMap((lang) => cars.map((c) => ({ lang, slug: c.slug })));
}

async function load(params: Promise<{ lang: string; slug: string }>) {
  const { lang: raw, slug } = await params;
  const lang: Lang = isLang(raw) ? raw : "en";
  const [car, s, cats] = await Promise.all([getCarBySlug(slug), getSettings(), getCategories("car")]);
  return { lang, car: car && localizeCar(car, lang), s: localizeSettings(s, lang), cats };
}

export async function generateMetadata({ params }: PageProps<"/[lang]/cars/[slug]">): Promise<Metadata> {
  const { lang, car, s } = await load(params);
  const d = t(lang);
  if (!car) return { title: d.car.notFound, robots: { index: false } };

  const name = carName(car);
  const title = d.car.metaTitle(name, s.city, formatPrice(minPrice(car), s.currency, lang));
  const description = snippet(`${name}: ${label(TRANSMISSIONS, car.transmission, lang).toLowerCase()}, ${label(FUELS, car.fuel, lang).toLowerCase()}, ${d.card.seats(car.seats)}. ${car.description}`);
  const p = `/cars/${car.slug}`;
  return {
    title,
    description,
    alternates: { canonical: path(lang, p), languages: languages(p) },
    openGraph: {
      ...ogBase(s.site_name, lang),
      title,
      description,
      url: path(lang, p),
      images: car.images.map((i) => ({ url: imageUrl(i.file)!, alt: name })),
    },
  };
}

export default function CarPage(props: PageProps<"/[lang]/cars/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-16 text-slate-500" aria-busy="true">…</div>}>
      <CarDetails params={props.params} />
    </Suspense>
  );
}

// Несуществующий slug отсекается раньше, в proxy.ts (честный HTTP 404); notFound() — страховка.
async function CarDetails({ params }: Pick<PageProps<"/[lang]/cars/[slug]">, "params">) {
  const { lang, car, s, cats } = await load(params);
  if (!car) notFound();
  const d = t(lang);
  const L = d.car.labels;

  const name = carName(car);
  const url = absoluteUrl(path(lang, `/cars/${car.slug}`));
  const images = car.images.map((i) => imageUrl(i.file)!);
  const features = car.features.split("\n").map((f) => f.trim()).filter(Boolean);
  const tiers = priceTiers(car);
  const booking = {
    carId: car.id, lang, currency: s.currency, pickups: pickupsFor(parsePickupPoints(s.pickup_points), lang),
    prices: { price_per_day: car.price_per_day, price_1_3: car.price_1_3, price_4_7: car.price_4_7, price_8_30: car.price_8_30, price_30_plus: car.price_30_plus },
  };
  const unitPrice = (price: number, from?: number, to?: number | null) => ({
    "@type": "UnitPriceSpecification",
    price,
    priceCurrency: s.currency,
    unitCode: "DAY",
    referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "DAY" },
    eligibleQuantity: from ? { "@type": "QuantitativeValue", minValue: from, maxValue: to ?? undefined, unitCode: "DAY" } : undefined,
  });
  const specs: [string, string | number][] = [
    [L.year, car.year],
    [L.category, categoryName(cats, car.category, lang)],
    [L.transmission, label(TRANSMISSIONS, car.transmission, lang)],
    [L.fuel, label(FUELS, car.fuel, lang)],
    [L.engine, car.engine],
    [L.drive, valueIn(lang, car.drive)],
    [L.seats, car.seats],
    [L.luggage, car.luggage],
    [L.color, car.color],
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Car",
        "@id": `${url}#car`,
        name,
        url,
        description: car.description || undefined,
        image: images.length ? images.map(absoluteUrl) : undefined,
        brand: { "@type": "Brand", name: car.brand },
        manufacturer: { "@type": "Organization", name: car.brand },
        model: car.model,
        vehicleModelDate: String(car.year),
        color: car.color || undefined,
        vehicleTransmission: TRANSMISSIONS[car.transmission as keyof typeof TRANSMISSIONS]?.schema,
        fuelType: FUELS[car.fuel as keyof typeof FUELS]?.schema,
        vehicleSeatingCapacity: car.seats,
        offers: {
          "@type": "Offer",
          url,
          businessFunction: "http://purl.org/goodrelations/v1#LeaseOut",
          availability: "https://schema.org/InStock",
          priceCurrency: s.currency,
          price: minPrice(car),
          eligibleDuration: { "@type": "QuantitativeValue", minValue: car.min_days, unitCode: "DAY" },
          priceSpecification: tiers.length ? tiers.map((t) => unitPrice(t.price, t.from, t.to)) : unitPrice(car.price_per_day),
          seller: { "@type": "AutoRental", "@id": absoluteUrl("/#business"), name: s.site_name },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: d.breadcrumbs.home, item: absoluteUrl(path(lang, "/")) },
          { "@type": "ListItem", position: 2, name: d.nav.cars, item: absoluteUrl(path(lang, "/cars")) },
          { "@type": "ListItem", position: 3, name, item: url },
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
          <li><Link href={path(lang, "/cars")} className="hover:text-brand">{d.nav.cars}</Link> /</li>
          <li aria-current="page" className="text-slate-800">{name}</li>
        </ol>
      </nav>

      <h1 className="mt-4 text-3xl font-extrabold md:text-4xl">{name}</h1>
      <p className="mt-1 text-slate-600">{d.car.rentIn(s.city)}</p>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div>
          {images.length > 0 && (
            <div className="grid gap-3">
              <div className="relative aspect-[3/2] overflow-hidden rounded-2xl bg-slate-200">
                <Photo src={images[0]} alt={d.car.photo(name, 1)} fill priority sizes="(min-width: 1024px) 760px, 100vw" className="object-cover" />
              </div>
              {images.length > 1 && (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {images.slice(1).map((src, i) => (
                    <a key={src} href={src} target="_blank" className="relative aspect-[3/2] overflow-hidden rounded-xl bg-slate-200">
                      <Photo src={src} alt={d.car.photo(name, i + 2)} fill sizes="200px" className="object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {car.description && (
            <section className="mt-10">
              <h2 className="text-2xl font-bold">{d.car.description}</h2>
              <p className="mt-3 whitespace-pre-line leading-7 text-slate-700">{car.description}</p>
            </section>
          )}

          <section className="mt-10">
            <h2 className="text-2xl font-bold">{d.car.specs(name)}</h2>
            <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
              {specs.filter(([, v]) => v !== "" && v != null).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-slate-200 py-3">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          {features.length > 0 && (
            <section className="mt-10">
              <h2 className="text-2xl font-bold">{d.car.features}</h2>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {features.map((f) => (
                  <li key={f} className="flex gap-2"><span className="text-brand">✓</span>{f}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="h-fit rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-24">
          <p className="text-3xl font-extrabold text-fg">
            {tiers.length > 0 && <span className="text-base font-medium text-slate-500">{d.card.from} </span>}
            {formatPrice(minPrice(car), s.currency, lang)}
            <span className="text-base font-medium text-slate-500"> {d.card.perDay}</span>
          </p>
          {tiers.length > 0 && (
            <table className="mt-4 w-full text-sm">
              <caption className="mb-2 text-left font-bold">{d.car.perDayByTerm}</caption>
              <tbody>
                {tiers.map((t) => (
                  <tr key={t.key} className="border-t border-slate-100">
                    <th scope="row" className="py-2 text-left font-normal text-slate-500">{d.tiers[t.key]}</th>
                    <td className="py-2 text-right font-bold">{formatPrice(t.price, s.currency, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <dl className="mt-4 space-y-2 text-sm">
            {car.deposit > 0 && (
              <div className="flex justify-between"><dt className="text-slate-500">{d.car.deposit}</dt><dd className="font-semibold">{formatPrice(car.deposit, s.currency, lang)}</dd></div>
            )}
          </dl>
          <div className="mt-6 border-t border-slate-100 pt-5">
            <Suspense fallback={<BookingForm {...booking} />}>
              <BookingFormFromUrl {...booking} />
            </Suspense>
          </div>
          {(s.whatsapp || s.telegram) && (
            <p className="my-3 flex items-center gap-3 text-xs text-slate-500 before:h-px before:flex-1 before:bg-slate-200 after:h-px after:flex-1 after:bg-slate-200">{d.booking.or}</p>
          )}
          {s.whatsapp && (
            <a
              href={whatsappUrl(s.whatsapp, d.car.whatsapp(name, url))}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-full bg-[#25D366] px-6 py-3 text-center font-bold text-white hover:bg-[#1da851]"
            >
              {d.car.book}
            </a>
          )}
          {s.telegram && (
            <a
              href={telegramUrl(s.telegram, d.car.whatsapp(name, url))}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block rounded-full bg-[#229ED9] px-6 py-3 text-center font-bold text-white hover:bg-[#1b86b9]"
            >
              {d.car.bookTelegram}
            </a>
          )}
          <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} className="mt-3 block rounded-full bg-brand px-6 py-3 text-center font-bold text-white hover:bg-brand-dark">
            {d.car.call} {s.phone}
          </a>
        </aside>
      </div>
    </article>
  );
}
