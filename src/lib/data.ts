import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "./db";
import type { Busy } from "./format";
import type { Lang } from "./i18n";

export type Settings = Record<
  | "site_name" | "city" | "hero_title" | "hero_subtitle" | "hero_image" | "hero_image_credit"
  | "owner_name" | "owner_about" | "owner_photo" | "phone" | "whatsapp" | "telegram" | "email" | "address"
  | "instagram" | "facebook" | "currency" | "delivery_info" | "logo" | "brand_color" | "socials" | "pickup_points"
  | "google_review_url" | "google_place_id" | "google_rating" | "google_rating_count" | "reviews_synced_at"
  | `${(typeof SETTINGS_I18N)[number]}_en`,
  string
>;

/** Соцсети из настроек: [{name, url}] (кривой JSON — пустой список). */
export type Social = { name: string; url: string };
export function parseSocials(json: string): Social[] {
  try {
    const list = JSON.parse(json || "[]");
    return Array.isArray(list) ? list.filter((x) => x && typeof x.name === "string" && typeof x.url === "string") : [];
  } catch {
    return [];
  }
}

/** Цвет темы из настроек, если он задан корректно (#rrggbb). */
export const brandColor = (s: Settings) => (/^#[0-9a-f]{6}$/i.test(s.brand_color) ? s.brand_color : null);

/** Настройки, у которых есть английская версия (ключ + "_en"). */
export const SETTINGS_I18N = ["city", "hero_title", "hero_subtitle", "address", "delivery_info"] as const;

export type Car = {
  id: number;
  slug: string;
  brand: string;
  model: string;
  year: number;
  category: string;
  body_type: string;
  transmission: string;
  fuel: string;
  engine: string;
  drive: string;
  seats: number;
  doors: number;
  luggage: number;
  color: string;
  price_per_day: number;
  price_1_3: number | null;
  price_4_7: number | null;
  price_8_30: number | null;
  price_30_plus: number | null;
  deposit: number;
  min_days: number;
  description: string;
  features: string;
  description_en: string;
  features_en: string;
  is_published: number;
  sort_order: number;
  updated_at: string;
  images: CarImage[];
};

export type CarImage = { id: number; car_id: number; file: string; sort_order: number };

export type Category = { id: number; kind: "car" | "sight"; key: string; name: string; name_en: string; sort_order: number };

export type SightImage = { id: number; sight_id: number; file: string; sort_order: number };

export type Sight = {
  id: number;
  slug: string;
  name: string;
  region: string;
  route: string;
  description: string;
  name_en: string;
  region_en: string;
  route_en: string;
  description_en: string;
  image: string | null;
  image_credit: string;
  category: string; // ключ categories (kind = 'sight')
  car_type: string; // ключ SIGHT_CARS
  distance_km: number | null;
  drive_min: number | null;
  maps_url: string;
  lat: number | null;
  lng: number | null;
  is_published: number;
  sort_order: number;
  updated_at: string;
  images: SightImage[]; // все фото по порядку; image — копия первого (обложка для карточек)
};

export type Review = {
  id: string;
  author: string;
  author_url: string;
  author_photo: string;
  rating: number;
  text: string;
  relative_time: string;
  published_at: string;
};

export type BookingStatus = "new" | "confirmed" | "done" | "cancelled";
export type ClientReview = "" | "good" | "bad";

export type Booking = {
  id: number;
  car_id: number | null;
  car_name: string;
  name: string;
  phone: string;
  date_from: string;
  date_to: string;
  comment: string;
  pickup: string;
  pickup_price: number;
  lang: string;
  status: BookingStatus;
  review: ClientReview;
  review_note: string;
  created_at: string;
};

// ── Сырые запросы (без кеша) — используются админкой ──

export function readSettings(): Settings {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Settings;
}

function withImages(cars: Omit<Car, "images">[]): Car[] {
  const imgs = db.prepare("SELECT * FROM car_images ORDER BY sort_order, id").all() as CarImage[];
  return cars.map((c) => ({ ...c, images: imgs.filter((i) => i.car_id === c.id) }));
}

export function readCars(onlyPublished: boolean): Car[] {
  const where = onlyPublished ? "WHERE is_published = 1" : "";
  const cars = db.prepare(`SELECT * FROM cars ${where} ORDER BY sort_order, id`).all() as Omit<Car, "images">[];
  return withImages(cars);
}

export function readCar(id: number): Car | undefined {
  const car = db.prepare("SELECT * FROM cars WHERE id = ?").get(id) as Omit<Car, "images"> | undefined;
  return car && withImages([car])[0];
}

function withSightImages(sights: Omit<Sight, "images">[]): Sight[] {
  const imgs = db.prepare("SELECT * FROM sight_images ORDER BY sort_order, id").all() as SightImage[];
  return sights.map((x) => ({ ...x, images: imgs.filter((i) => i.sight_id === x.id) }));
}

export function readSights(onlyPublished: boolean): Sight[] {
  const where = onlyPublished ? "WHERE is_published = 1" : "";
  return withSightImages(db.prepare(`SELECT * FROM sights ${where} ORDER BY sort_order, id`).all() as Omit<Sight, "images">[]);
}

/** Заявки: сначала новые, внутри — свежие сверху. */
export function readBookings(): Booking[] {
  return db.prepare(`SELECT * FROM bookings ORDER BY status = 'new' DESC, created_at DESC, id DESC`).all() as Booking[];
}

/** Фильтры каталога в порядке из админки. */
export function readCategories(kind: Category["kind"]): Category[] {
  return db.prepare("SELECT * FROM categories WHERE kind = ? ORDER BY sort_order, id").all(kind) as Category[];
}

/** Название фильтра на языке страницы (английское пустое — русское); неизвестный ключ — как есть. */
export function categoryName(cats: Category[], key: string, lang: Lang) {
  const c = cats.find((x) => x.key === key);
  return c ? (lang === "en" && c.name_en.trim() ? c.name_en : c.name) : key;
}

export function readSight(id: number): Sight | undefined {
  const x = db.prepare("SELECT * FROM sights WHERE id = ?").get(id) as Omit<Sight, "images"> | undefined;
  return x && withSightImages([x])[0];
}

// ── Кешируемые запросы для публичного сайта ──
// Сбрасываются через updateTag() в server actions админки.

export async function getSettings() {
  "use cache";
  cacheLife("max");
  cacheTag("settings");
  return readSettings();
}

export async function getCars() {
  "use cache";
  cacheLife("max");
  cacheTag("cars");
  return readCars(true);
}

export async function getCarBySlug(slug: string) {
  "use cache";
  cacheLife("max");
  cacheTag("cars");
  return readCars(true).find((c) => c.slug === slug) ?? null;
}

/** Занятость машин: подтверждённые брони, которые ещё не закончились. carId -> периоды. */
export function readBusy(): Record<number, Busy[]> {
  const rows = db.prepare(`SELECT car_id, date_from, date_to FROM bookings
    WHERE status = 'confirmed' AND car_id IS NOT NULL AND date_to >= date('now', '-1 day') ORDER BY date_from`).all() as
    { car_id: number; date_from: string; date_to: string }[];
  const out: Record<number, Busy[]> = {};
  for (const r of rows) (out[r.car_id] ??= []).push({ from: r.date_from, to: r.date_to });
  return out;
}

export async function getBusy() {
  "use cache";
  cacheLife("hours"); // закончившиеся брони пропадают с плашек сами, без правок в админке
  cacheTag("bookings"); // сбрасывается при подтверждении/отклонении/удалении брони
  return readBusy();
}

export async function getReviews() {
  "use cache";
  cacheLife("max");
  cacheTag("reviews");
  return db.prepare("SELECT * FROM reviews ORDER BY sort_order").all() as Review[];
}

export async function getSights() {
  "use cache";
  cacheLife("max");
  cacheTag("sights");
  return readSights(true);
}

export async function getCategories(kind: Category["kind"]) {
  "use cache";
  cacheLife("max");
  cacheTag("categories");
  return readCategories(kind);
}

export async function getSightBySlug(slug: string) {
  "use cache";
  cacheLife("max");
  cacheTag("sights");
  return readSights(true).find((x) => x.slug === slug) ?? null;
}

// ── Язык: английская версия текста, если заполнена, иначе русская ──

const pick = (lang: Lang, ru: string, en: string) => (lang === "en" && en.trim() ? en : ru);

export function localizeSettings(s: Settings, lang: Lang): Settings {
  const out = { ...s };
  for (const k of SETTINGS_I18N) out[k] = pick(lang, s[k], s[`${k}_en`]);
  return out;
}

export function localizeCar(c: Car, lang: Lang): Car {
  return { ...c, description: pick(lang, c.description, c.description_en), features: pick(lang, c.features, c.features_en) };
}

export function localizeSight(x: Sight, lang: Lang): Sight {
  return {
    ...x,
    name: pick(lang, x.name, x.name_en),
    region: pick(lang, x.region, x.region_en),
    route: pick(lang, x.route, x.route_en),
    description: pick(lang, x.description, x.description_en),
  };
}
