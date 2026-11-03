import Link from "next/link";
import type { Metadata } from "next";
import { categoryName, getCars, parseSocials, getCategories, getReviews, getSettings, getSights, localizeSettings, localizeSight } from "@/lib/data";
import {
  SIGHT_CARS, absoluteUrl, carCard, formatPrice, imageUrl, label, mapsUrl, minPrice, ogBase, parsePickupPoints, showcase, snippet, telegramUrl, whatsappUrl,
} from "@/lib/format";
import { langFrom, languages, path, t } from "@/lib/i18n";
import { googleMapsUrl } from "@/lib/reviews";
import { CarCard } from "@/components/CarCard";
import { JsonLd } from "@/components/JsonLd";
import { Photo } from "@/components/Photo";
import { SearchForm } from "@/components/SearchForm";
import { SightCard } from "@/components/SightCard";
import { Stars } from "@/components/Stars";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const lang = await langFrom(params);
  const s = localizeSettings(await getSettings(), lang);
  const og = imageUrl(s.hero_image);
  return {
    description: snippet(s.hero_subtitle),
    alternates: { canonical: path(lang, "/"), languages: languages("/") },
    openGraph: {
      ...ogBase(s.site_name, lang),
      title: `${s.hero_title} — ${s.site_name}`,
      description: s.hero_subtitle,
      url: path(lang, "/"),
      images: og ? [og] : undefined,
    },
  };
}

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const lang = await langFrom(params);
  const d = t(lang);
  const to = (p: string) => path(lang, p);
  const [raw, cars, rawSights, reviews, carCats, sightCats] = await Promise.all([
    getSettings(), getCars(), getSights(), getReviews(), getCategories("car"), getCategories("sight"),
  ]);
  const s = localizeSettings(raw, lang);
  const sights = rawSights.map((x) => localizeSight(x, lang));
  const prices = cars.map(minPrice);
  const low = prices.length ? Math.min(...prices) : null;
  const high = cars.length ? Math.max(...cars.map((c) => c.price_per_day)) : null;
  const hero = imageUrl(s.hero_image);
  const rating = Number(s.google_rating) || null;
  const ratingCount = Number(s.google_rating_count) || 0;
  const mapsLink = googleMapsUrl(s.google_review_url);
  const popular = showcase(cars, 6);
  const places = sights.slice(0, 6);
  // Классы из реальных машин (как фильтр в каталоге), в порядке из админки
  const types = carCats.filter((c) => cars.some((x) => x.category === c.key)).map((c) => [c.key, categoryName(carCats, c.key, lang)] as [string, string]);
  // «Бесплатная подача в аэропорт» — если в пунктах подачи есть бесплатный аэропорт Батуми (по русскому названию)
  const freeAirport = parsePickupPoints(raw.pickup_points).some((p) => /аэропорт/i.test(p.name) && /батуми/i.test(p.name) && p.price === 0);
  const phrases = [
    low != null && d.home.carsFrom(cars.length, formatPrice(low, s.currency, lang)),
    d.home.noHidden,
    freeAirport && d.home.freeAirport,
    d.home.support,
  ].filter((p): p is string => Boolean(p));
  const businessImage = hero ?? imageUrl(cars[0]?.images[0]?.file);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AutoRental",
        "@id": absoluteUrl("/#business"),
        name: s.site_name,
        description: s.hero_subtitle,
        url: absoluteUrl(to("/")),
        telephone: s.phone,
        email: s.email || undefined,
        image: businessImage ? absoluteUrl(businessImage) : undefined,
        priceRange: low != null ? `${formatPrice(low, s.currency, lang)}–${formatPrice(high!, s.currency, lang)}` : undefined,
        address: { "@type": "PostalAddress", streetAddress: s.address || undefined, addressLocality: s.city, addressRegion: d.home.jsonLdRegion, addressCountry: "GE" },
        areaServed: [{ "@type": "City", name: s.city }, { "@type": "Country", name: d.home.jsonLdCountry }],
        currenciesAccepted: s.currency,
        hasMap: mapsLink ?? undefined,
        sameAs: [...parseSocials(s.socials).map((x) => x.url), s.telegram && telegramUrl(s.telegram), mapsLink].filter(Boolean),
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />

      {/* ── Главный экран: заголовок, по центру поиск, под ним преимущества ── */}
      <section className="relative isolate z-10 bg-ink text-white">
        {hero && <Photo src={hero} alt={d.home.heroAlt} fill priority sizes="100vw" className="-z-10 object-cover" />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/70 via-ink/35 to-ink/70" />
        <div className="mx-auto flex min-h-[640px] max-w-6xl flex-col items-center justify-center px-4 py-16 text-center md:min-h-[88vh]">
          <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.1] md:text-6xl">{s.hero_title}</h1>
          <div className="mt-8 w-full max-w-5xl text-left md:mt-10">
            <SearchForm types={types} lang={lang} />
          </div>
          <ul className="mt-6 flex flex-wrap justify-center gap-2" aria-label={d.home.whyUs}>
            {phrases.map((p) => (
              <li key={p} className="rounded-full bg-ink/40 px-4 py-2 text-sm font-semibold backdrop-blur">
                <span className="mr-1.5 text-brand" aria-hidden>✓</span>{p}
              </li>
            ))}
          </ul>
          {rating && (
            <a href="#reviews" className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink/40 px-4 py-1.5 text-sm font-semibold backdrop-blur hover:bg-ink/60">
              <Stars value={rating} lang={lang} className="text-amber-400" /> {rating.toFixed(1)} · {d.home.reviewsBadge(ratingCount)}
            </a>
          )}
        </div>
      </section>

      {/* ── Как это работает: спокойный блок сразу под главным экраном ── */}
      <section aria-labelledby="how-title" className="mx-auto max-w-6xl px-4 pt-14">
        <div className="rounded-3xl bg-surface px-6 py-10 shadow-sm ring-1 ring-slate-200 md:px-10">
          <div className="text-center">
            <h2 id="how-title" className="text-2xl font-extrabold md:text-3xl">{d.how.title}</h2>
            <p className="mx-auto mt-3 max-w-2xl leading-7 text-slate-600">{d.how.lead}</p>
          </div>
          <ol className="relative mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
            {/* пунктир между шагами (на широком экране) */}
            <span aria-hidden="true" className="absolute inset-x-[16.7%] top-8 hidden border-t-2 border-dashed border-brand/30 md:block" />
            {d.how.steps.map(([title, text], i) => (
              <li key={title} className="relative text-center">
                <span className="relative mx-auto grid size-16 place-items-center rounded-full bg-brand text-white shadow-lg shadow-brand/30 ring-8 ring-surface">
                  {HOW_ICONS[i]}
                  <span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-ink text-xs font-extrabold text-white ring-2 ring-surface">{i + 1}</span>
                </span>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Популярные автомобили (по одному каждого класса) ── */}
      <section id="cars" aria-labelledby="cars-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-20">
        <SectionHead id="cars-title" title={d.home.popularTitle} text={d.home.popularText} />
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {popular.map((c) => <li key={c.id}><CarCard car={carCard(c, s.city, s.currency, lang, categoryName(carCats, c.category, lang))} lang={lang} /></li>)}
        </ul>
        <MoreLink href={to("/cars")}>{d.home.seeAllCars(cars.length)}</MoreLink>
      </section>

      {/* ── Куда поехать ── */}
      <section id="sights" aria-labelledby="sights-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24">
        <SectionHead id="sights-title" title={d.home.sightsTitle(s.city)} text={d.home.sightsText} />
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {places.map((x) => (
            <li key={x.id}>
              <SightCard lang={lang} sight={{ id: x.id, name: x.name, region: x.region, categoryLabel: categoryName(sightCats, x.category, lang), category: x.category, description: x.description, image: imageUrl(x.image), distanceKm: x.distance_km, carType: label(SIGHT_CARS, x.car_type, lang), slug: x.slug, mapsHref: mapsUrl(x) }} />
            </li>
          ))}
        </ul>
        <MoreLink href={to("/sights")}>{d.home.seeAllSights(sights.length)}</MoreLink>
      </section>

      {/* ── Отзывы Google ── */}
      {(rating || reviews.length > 0 || s.google_review_url) && (
        <section id="reviews" aria-labelledby="reviews-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h2 id="reviews-title" className="text-3xl font-extrabold md:text-4xl">{d.home.reviewsTitle}</h2>
              {rating ? (
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-5xl font-extrabold">{rating.toFixed(1)}</span>
                  <div>
                    <Stars value={rating} lang={lang} className="text-2xl text-amber-400" />
                    <p className="text-sm text-slate-600">{d.home.reviewsBadge(ratingCount)}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-slate-600">{d.home.reviewsEmpty}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {mapsLink && (
                <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="rounded-full px-5 py-2.5 text-sm font-bold ring-1 ring-slate-300 hover:ring-brand">
                  {d.home.allReviews}
                </a>
              )}
              {s.google_review_url && (
                <a href={s.google_review_url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white ring-1 ring-white/10 hover:bg-brand">
                  {d.home.leaveReview}
                </a>
              )}
            </div>
          </div>
          {reviews.length > 0 && (
            <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {reviews.map((r) => (
                <li key={r.id} className="flex flex-col rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center gap-3">
                    {r.author_photo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- аватар с googleusercontent, внешний домен
                      <img src={r.author_photo} alt="" width={40} height={40} className="size-10 rounded-full" referrerPolicy="no-referrer" loading="lazy" />
                    ) : (
                      <span className="grid size-10 place-items-center rounded-full bg-slate-200 font-bold text-slate-600">{r.author.charAt(0)}</span>
                    )}
                    <div>
                      <p className="font-bold">
                        {r.author_url ? <a href={r.author_url} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-brand">{r.author}</a> : r.author}
                      </p>
                      <p className="text-xs text-slate-500">{r.relative_time}</p>
                    </div>
                  </div>
                  <Stars value={r.rating} lang={lang} className="mt-3 text-amber-400" />
                  {r.text && <p className="mt-3 line-clamp-6 text-sm leading-6 text-slate-700">{r.text}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── Почему выбирают нас ── */}
      <section id="about" aria-labelledby="about-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-24">
        <h2 id="about-title" className="text-3xl font-extrabold md:text-4xl">{d.home.aboutTitle}</h2>
        <p className="mt-2 max-w-2xl text-slate-600">{d.home.aboutLead}</p>
        <ul className="mt-8 grid gap-6 md:grid-cols-3">
          {d.home.reasons.map(([title, text], i) => (
            <li key={title} className="rounded-3xl bg-surface p-7 shadow-sm ring-1 ring-slate-200">
              <span className="grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand">{REASON_ICONS[i]}</span>
              <h3 className="mt-5 text-lg font-bold">{title}</h3>
              <p className="mt-2 leading-7 text-slate-600">{text}</p>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          {s.whatsapp && (
            <a href={whatsappUrl(s.whatsapp, d.whatsappHello)} target="_blank" rel="noopener noreferrer"
              className="inline-block rounded-full bg-[#25D366] px-6 py-3 font-bold text-white hover:bg-[#1da851]">
              {d.home.writeWhatsapp}
            </a>
          )}
          {s.telegram && (
            <a href={telegramUrl(s.telegram, d.whatsappHello)} target="_blank" rel="noopener noreferrer"
              className="inline-block rounded-full bg-[#229ED9] px-6 py-3 font-bold text-white hover:bg-[#1b86b9]">
              {d.home.writeTelegram}
            </a>
          )}
        </div>
      </section>
    </>
  );
}

// Иконки шагов «Как это работает»: машина, форма, звонок
const icon = (path: React.ReactNode) => (
  <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
);
const HOW_ICONS = [
  icon(<><path d="M5 17h14v-5l-2-5H7l-2 5v5z" /><path d="M5 12h14" /><circle cx="8" cy="17" r="2" /><circle cx="16" cy="17" r="2" /></>),
  icon(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>),
  icon(<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />),
];

/** Заголовок блока; «показать все» — кнопкой под карточками (MoreLink). */
function SectionHead({ id, title, text }: { id: string; title: string; text: string }) {
  return (
    <div>
      <h2 id={id} className="text-3xl font-extrabold md:text-4xl">{title}</h2>
      <p className="mt-2 max-w-2xl text-slate-600">{text}</p>
    </div>
  );
}

function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <div className="mt-10 text-center">
      <Link href={href} className="inline-block rounded-full bg-ink px-8 py-3.5 font-bold text-white ring-1 ring-white/10 hover:bg-brand">
        {children} →
      </Link>
    </div>
  );
}

const reasonIcon = { viewBox: "0 0 24 24", className: "size-6", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
/** Иконки «Почему выбирают нас»: поддержка, цена, подача — по порядку пунктов в словаре. */
const REASON_ICONS = [
  <svg key="support" {...reasonIcon}><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></svg>,
  <svg key="price" {...reasonIcon}><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>,
  <svg key="delivery" {...reasonIcon}><path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>,
];
