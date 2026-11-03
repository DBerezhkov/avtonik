// Общие справочники и форматтеры — используются и на сайте, и в админке.

import { LOCALE_TAG, OG_LOCALE, t, type Lang } from "./i18n";

export const SITE_URL = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export const TRANSMISSIONS = {
  automatic: { label: "Автомат", en: "Automatic", schema: "AutomaticTransmission" },
  manual: { label: "Механика", en: "Manual", schema: "ManualTransmission" },
} as const;

export const FUELS = {
  petrol: { label: "Бензин", en: "Petrol", schema: "Gasoline" },
  diesel: { label: "Дизель", en: "Diesel", schema: "Diesel" },
  hybrid: { label: "Гибрид", en: "Hybrid", schema: "Hybrid" },
  electric: { label: "Электро", en: "Electric", schema: "Electric" },
  gas: { label: "Газ/бензин", en: "LPG/petrol", schema: "LPG" },
} as const;

/** Какая машина нужна, чтобы доехать до места (поле sights.car_type). */
export const SIGHT_CARS = {
  any: { label: "Любая машина", en: "Any car" },
  crossover: { label: "Кроссовер", en: "Crossover / SUV" },
  awd: { label: "Полный привод 4×4", en: "4×4 / AWD" },
} as const;

/** Подпись значения справочника: label — русская (и для админки), en — английская. */
export function label<T extends Record<string, { label: string; en: string }>>(dict: T, key: string, lang: Lang = "ru") {
  const item = (dict as Record<string, { label: string; en: string }>)[key];
  return item ? (lang === "en" ? item.en : item.label) : key;
}

/** Полное название машины — одно и то же везде: в H1, title, alt, JSON-LD. */
export function carName(c: { brand: string; model: string; year: number }) {
  return `${c.brand} ${c.model} ${c.year}`;
}

export function imageUrl(file: string | null | undefined) {
  return file ? `/uploads/${file}` : null;
}

export function absoluteUrl(path: string) {
  return `${SITE_URL}${path}`;
}

const SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GEL: "₾" };

export function formatPrice(value: number, currency: string, lang: Lang = "ru") {
  const sym = SYMBOLS[currency];
  const n = value.toLocaleString(LOCALE_TAG[lang]);
  return sym === "$" || sym === "€" ? `${sym}${n}` : `${n} ${sym ?? currency}`;
}

export type Priced = {
  price_per_day: number;
  price_1_3: number | null;
  price_4_7: number | null;
  price_8_30: number | null;
  price_30_plus: number | null;
};

/** Цены за сутки в зависимости от срока аренды; пусто, если ступени не заданы. */
export function priceTiers(c: Priced) {
  return [
    { key: "1-3", from: 1, to: 3, price: c.price_1_3 },
    { key: "4-7", from: 4, to: 7, price: c.price_4_7 },
    { key: "8-30", from: 8, to: 30, price: c.price_8_30 },
    { key: "31+", from: 31, to: null, price: c.price_30_plus },
  ].filter((t): t is typeof t & { price: number } => t.price != null);
}

/** Занятый период машины (подтверждённая бронь): даты YYYY-MM-DD, to — день возврата. */
export type Busy = { from: string; to: string };

/** Пункт подачи из настроек (pickup_points, JSON): названия на двух языках и доплата — одна для обоих (0 — бесплатно). */
export type PickupPoint = { name: string; name_en: string; price: number };
/** Пункт подачи на языке страницы. */
export type Pickup = { place: string; price: number };

export function parsePickupPoints(json: string): PickupPoint[] {
  try {
    const list = JSON.parse(json || "[]");
    return Array.isArray(list)
      ? list.filter((p) => p && typeof p.name === "string" && p.name && Number(p.price) >= 0)
          .map((p) => ({ name: p.name, name_en: typeof p.name_en === "string" ? p.name_en : "", price: Number(p.price) }))
      : [];
  } catch {
    return [];
  }
}

/** Пункты на языке страницы: пустое английское название — русское. */
export const pickupsFor = (points: PickupPoint[], lang: Lang): Pickup[] =>
  points.map((p) => ({ place: (lang === "en" && p.name_en) || p.name, price: p.price }));

/** Цена подачи для показа: «$16» или «бесплатно». */
export const pickupFee = (p: Pickup, currency: string, lang: Lang) => (p.price > 0 ? formatPrice(p.price, currency, lang) : t(lang).booking.free);

/** Пересекается ли аренда [from, to) с занятыми периодами. Вернуть машину и выдать её следующему в один день — можно. */
export function overlapsBusy(busy: Busy[], from: string, to: string) {
  return busy.some((b) => from < b.to && b.from < to);
}

/** Стоимость аренды на days суток: ставка за сутки — из ступени по сроку (1–3, 4–7, 8–30, 31+), без ступени — базовая цена. */
export function rentalPrice(c: Priced, days: number) {
  const tier = priceTiers(c).find((t) => days >= t.from && (t.to == null || days <= t.to));
  const perDay = tier?.price ?? c.price_per_day;
  return { perDay, total: perDay * days };
}

/** Минимальная цена за сутки — для «от $X». */
export function minPrice(c: Priced) {
  return Math.min(c.price_per_day, ...priceTiers(c).map((t) => t.price));
}

export function mapsUrl(s: { maps_url: string; lat: number | null; lng: number | null; name: string }) {
  if (s.maps_url) return s.maps_url;
  const q = s.lat != null && s.lng != null ? `${s.lat},${s.lng}` : s.name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function whatsappUrl(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

/** Чат в Telegram по @username; text подставляется в поле ввода (клиенты без поддержки просто откроют чат). */
export function telegramUrl(username: string, text?: string) {
  const base = `https://t.me/${username.trim().replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Обрезка текста для meta description (~160 символов) по границе слова. */
export function snippet(text: string, max = 160) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, t.lastIndexOf(" ", max - 1)).replace(/[,.;:—-]+$/, "") + "…";
}

/** Общая часть Open Graph: Next сливает metadata поверхностно, и openGraph страницы целиком заменяет layout. */
export function ogBase(siteName: string, lang: Lang) {
  return { type: "website" as const, locale: OG_LOCALE[lang], alternateLocale: [OG_LOCALE[lang === "en" ? "ru" : "en"]], siteName };
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

type CarLike = Priced & {
  id: number; slug: string; brand: string; model: string; year: number; category: string;
  transmission: string; fuel: string; seats: number; images: { file: string }[];
};

/** Данные карточки машины (главная и каталог /cars). categoryLabel — название фильтра (класса) на языке страницы. */
export function carCard(c: CarLike, city: string, currency: string, lang: Lang, categoryLabel: string) {
  const d = t(lang);
  return {
    id: c.id,
    slug: c.slug,
    name: carName(c),
    category: c.category,
    categoryLabel,
    specs: [label(TRANSMISSIONS, c.transmission, lang), label(FUELS, c.fuel, lang), d.card.seats(c.seats)].filter(Boolean).join(" · "),
    price: formatPrice(minPrice(c), currency, lang),
    image: imageUrl(c.images[0]?.file),
    alt: d.card.rentIn(carName(c), city),
  };
}

/** Витрина: по одной машине каждого класса (в порядке сортировки), остаток — следующими по порядку. */
export function showcase<T extends { id: number; category: string }>(cars: T[], n: number) {
  const seen = new Set<string>();
  const firsts = cars.filter((c) => !seen.has(c.category) && seen.add(c.category));
  return [...firsts, ...cars.filter((c) => !firsts.includes(c))].slice(0, n);
}
