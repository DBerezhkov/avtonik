"use server";

import crypto from "node:crypto";
import { refresh, updateTag } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_LANG_COOKIE, adminLang, adminT } from "@/lib/admin-i18n";
import { getAdminLang } from "@/lib/admin-lang";
import { assignSightSlugs, db } from "@/lib/db";
import { readCar, readSettings, readSight, type BookingStatus } from "@/lib/data";
import { changeStatus, removeBooking } from "@/lib/bookings";
import { FUELS, SIGHT_CARS, TRANSMISSIONS, slugify } from "@/lib/format";
import { coordsFromMapsUrl, roadFromBatumi } from "@/lib/distance";
import { filesFrom, removeImage, saveImage } from "@/lib/images";
import { syncGoogleReviews } from "@/lib/reviews";
import { createSession, deleteSession, requireAdmin } from "@/lib/session";
import { translateToEnglish } from "@/lib/translate";
import { verifyInitData } from "@/lib/telegram-auth";

export type FormState = { error?: string; values?: Record<string, string> } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string) => Number.parseInt(str(f, k), 10);
const optInt = (f: FormData, k: string) => (str(f, k) === "" ? null : int(f, k));
const num = (f: FormData, k: string) => (str(f, k) === "" ? null : Number(str(f, k).replace(",", ".")));
const bool = (f: FormData, k: string) => (f.get(k) ? 1 : 0);

/** Ошибка + введённые значения: React сбрасывает форму после action, а так поля заполнятся обратно. */
function fail(form: FormData, error: string): FormState {
  const values: Record<string, string> = {};
  for (const [k, v] of form) if (typeof v === "string" && !k.startsWith("$")) values[k] = v;
  return { error, values };
}

// ── Вход из мини-аппа Telegram: подпись initData вместо пароля ──

export async function telegramLogin(_prev: FormState, form: FormData): Promise<FormState> {
  if (!verifyInitData(str(form, "init_data"))) return { error: adminT(await getAdminLang()).errors.telegramLogin };
  await createSession({ telegram: true });
  redirect("/admin/tg"); // та же страница мини-аппа — теперь со списком броней
}

// ── Вход / выход ──

function safeEqual(a: string, b: string) {
  const h = (s: string) => crypto.createHash("sha256").update(s).digest();
  return crypto.timingSafeEqual(h(a), h(b));
}

// Защита от перебора: после 10 неудач подряд вход блокируется на 15 минут (один админ — один общий счётчик).
const LOCK = { fails: 0, until: 0 };

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  const { ADMIN_LOGIN, ADMIN_PASSWORD } = process.env;
  const e = adminT(await getAdminLang()).errors;
  if (!ADMIN_LOGIN || !ADMIN_PASSWORD) return { error: e.noCredentials };
  if (Date.now() < LOCK.until) return { error: e.tooManyAttempts };
  const ok = safeEqual(str(form, "login"), ADMIN_LOGIN) && safeEqual(String(form.get("password") ?? ""), ADMIN_PASSWORD);
  if (!ok) {
    if (++LOCK.fails >= 10) Object.assign(LOCK, { fails: 0, until: Date.now() + 15 * 60_000 });
    await new Promise((r) => setTimeout(r, 1000));
    return { error: e.wrongCredentials };
  }
  LOCK.fails = 0;
  await createSession();
  redirect("/admin");
}

export async function logout() {
  await deleteSession();
  redirect("/admin/login");
}

/** Переключатель RU / EN в шапке: язык интерфейса админки в cookie, страница перерисовывается на том же адресе. */
export async function setAdminLang(form: FormData) {
  await requireAdmin("bookings"); // переключатель языка есть и в мини-аппе
  (await cookies()).set(ADMIN_LANG_COOKIE, adminLang(str(form, "lang")), {
    path: "/admin",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  refresh();
}

// ── Машины ──

function uniqueSlug(base: string, id: number | null) {
  let slug = base;
  for (let n = 2; db.prepare("SELECT 1 FROM cars WHERE slug = ? AND id IS NOT ?").get(slug, id); n++) slug = `${base}-${n}`;
  return slug;
}

export async function saveCar(id: number | null, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const e = adminT(await getAdminLang()).errors;
  // В форме одно поле «Название»: первое слово — марка, остальное — модель (на сайте они выводятся раздельно)
  const [brand = "", ...model] = str(form, "name").split(/\s+/).filter(Boolean);
  const car = {
    brand,
    model: model.join(" "),
    year: int(form, "year"),
    category: str(form, "category"),
    transmission: str(form, "transmission"),
    fuel: str(form, "fuel"),
    seats: int(form, "seats"),
    luggage: int(form, "luggage"),
    price_per_day: int(form, "price_per_day"),
    price_1_3: optInt(form, "price_1_3"),
    price_4_7: optInt(form, "price_4_7"),
    price_8_30: optInt(form, "price_8_30"),
    price_30_plus: optInt(form, "price_30_plus"),
    description: str(form, "description"),
    is_published: bool(form, "is_published"),
  };

  if (!car.brand || !car.model) return fail(form, e.carName);
  if (!(car.year >= 1980 && car.year <= 2100)) return fail(form, e.year);
  if (!(car.price_per_day > 0)) return fail(form, e.pricePerDay);
  if (!(car.transmission in TRANSMISSIONS) || !(car.fuel in FUELS) || !categoryExists("car", car.category)) {
    return fail(form, e.carOptions);
  }
  for (const k of ["price_1_3", "price_4_7", "price_8_30", "price_30_plus"] as const) {
    if (car[k] !== null && !(car[k]! > 0)) return fail(form, e.tierPrices);
  }
  for (const k of ["seats", "luggage"] as const) if (!(car[k] >= 0)) return fail(form, e.numbers);

  // Адрес страницы — из названия и года; у одинаковых машин номер: toyota-prius-2015, -2, -3…
  // Если название и год не менялись, адрес остаётся прежним (ссылки и позиции в поиске не теряются).
  const base = slugify(`${car.brand}-${car.model}-${car.year}`);
  const oldSlug = id ? (db.prepare("SELECT slug FROM cars WHERE id = ?").get(id) as { slug: string } | undefined)?.slug : undefined;
  const slug = oldSlug && new RegExp(`^${base}(-\\d+)?$`).test(oldSlug) ? oldSlug : uniqueSlug(base, id);

  // Английское описание переводится само — только если русское изменилось или перевода ещё нет
  const prev = id ? (db.prepare("SELECT description, description_en FROM cars WHERE id = ?").get(id) as { description: string; description_en: string } | undefined) : undefined;
  const description_en = prev && prev.description === car.description && prev.description_en ? prev.description_en : await translateToEnglish(car.description);

  const files = filesFrom(form, "images");
  const saved: string[] = [];
  try {
    for (const f of files) saved.push(await saveImage(f, slug));
  } catch {
    await Promise.all(saved.map(removeImage));
    return fail(form, e.photo);
  }

  let carId: number | null;
  try {
    carId = db.transaction(() => {
    let cid = id;
    if (cid) {
      const old = db.prepare("SELECT slug FROM cars WHERE id = ?").get(cid) as { slug: string } | undefined;
      if (old && old.slug !== slug) {
        db.prepare("INSERT OR REPLACE INTO car_slug_history (slug, car_id) VALUES (?, ?)").run(old.slug, cid);
      }
      db.prepare(`UPDATE cars SET slug=@slug, brand=@brand, model=@model, year=@year, category=@category,
        transmission=@transmission, fuel=@fuel, seats=@seats, luggage=@luggage, price_per_day=@price_per_day,
        price_1_3=@price_1_3, price_4_7=@price_4_7, price_8_30=@price_8_30, price_30_plus=@price_30_plus,
        description=@description, description_en=@description_en, is_published=@is_published, updated_at=datetime('now') WHERE id=@id`).run({ ...car, description_en, slug, id: cid });
    } else {
      // Новая машина — в конец списка
      cid = Number(db.prepare(`INSERT INTO cars (slug, brand, model, year, category, transmission, fuel, seats, luggage,
        price_per_day, price_1_3, price_4_7, price_8_30, price_30_plus, description, description_en, is_published, sort_order)
        VALUES (@slug, @brand, @model, @year, @category, @transmission, @fuel, @seats, @luggage,
        @price_per_day, @price_1_3, @price_4_7, @price_8_30, @price_30_plus, @description, @description_en, @is_published, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM cars))`)
        .run({ ...car, description_en, slug }).lastInsertRowid);
    }
    db.prepare("DELETE FROM car_slug_history WHERE slug = ?").run(slug);
    const max = (db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM car_images WHERE car_id = ?").get(cid) as { m: number }).m;
    const ins = db.prepare("INSERT INTO car_images (car_id, file, sort_order) VALUES (?, ?, ?)");
    saved.forEach((file, i) => ins.run(cid, file, max + 1 + i));
    return cid;
  })();
  } catch {
    await Promise.all(saved.map(removeImage)); // загруженные фото без записи в БД не оставляем
    return fail(form, e.carGone);
  }

  updateTag("cars");
  redirect(`/admin?saved=${carId}`); // модалка закрывается, на сетке — «Сохранено»
}

export async function deleteCar(id: number) {
  await requireAdmin();
  const car = readCar(id);
  if (!car) return;
  db.prepare("DELETE FROM cars WHERE id = ?").run(id);
  await Promise.all(car.images.map((i) => removeImage(i.file)));
  updateTag("cars");
  redirect("/admin");
}

export async function deleteCarImage(imageId: number) {
  await requireAdmin();
  const img = db.prepare("SELECT * FROM car_images WHERE id = ?").get(imageId) as { file: string; car_id: number } | undefined;
  if (!img) return;
  db.prepare("DELETE FROM car_images WHERE id = ?").run(imageId);
  db.prepare("UPDATE cars SET updated_at = datetime('now') WHERE id = ?").run(img.car_id);
  await removeImage(img.file);
  updateTag("cars");
}

/** Новый порядок фото машины (перетаскивание в модалке); первое — главное. */
export async function reorderCarImages(carId: number, imageIds: number[]) {
  await requireAdmin();
  const upd = db.prepare("UPDATE car_images SET sort_order = ? WHERE id = ? AND car_id = ?");
  db.transaction(() => {
    imageIds.forEach((id, i) => upd.run(i, id, carId));
    db.prepare("UPDATE cars SET updated_at = datetime('now') WHERE id = ?").run(carId);
  })();
  updateTag("cars");
}

// ── Достопримечательности ──

export async function saveSight(id: number | null, _prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const e = adminT(await getAdminLang()).errors;
  const sight = {
    name: str(form, "name"),
    region: str(form, "region"),
    category: str(form, "category"),
    description: str(form, "description"),
    name_en: str(form, "name_en"),
    region_en: str(form, "region_en"),
    description_en: str(form, "description_en"),
    car_type: str(form, "car_type"),
    distance_km: optInt(form, "distance_km"),
    drive_min: optInt(form, "drive_min"),
    maps_url: str(form, "maps_url"),
    lat: num(form, "lat"),
    lng: num(form, "lng"),
    is_published: bool(form, "is_published"),
    sort_order: int(form, "sort_order") || 0,
  };
  if (!sight.name) return fail(form, e.sightName);
  if (sight.maps_url && !isGoogleMapsUrl(sight.maps_url)) return fail(form, e.mapsUrl);
  if ((sight.lat != null && !(Math.abs(sight.lat) <= 90)) || (sight.lng != null && !(Math.abs(sight.lng) <= 180))) {
    return fail(form, e.coords);
  }
  if (!(sight.car_type in SIGHT_CARS)) sight.car_type = "any";
  if (!categoryExists("sight", sight.category)) sight.category = "";
  for (const k of ["distance_km", "drive_min"] as const) if (sight[k] !== null && !(sight[k]! >= 0)) return fail(form, e.numbers);
  const old = id ? readSight(id) : undefined;
  // Координаты из ссылки Google Maps: поля пустые или ссылку сменили, а координаты оставили прежними
  const sameCoords = !!old && sight.lat === old.lat && sight.lng === old.lng;
  if (sight.maps_url && ((sight.lat == null && sight.lng == null) || (sameCoords && sight.maps_url !== old!.maps_url))) {
    const p = await coordsFromMapsUrl(sight.maps_url);
    if (p) Object.assign(sight, p);
  }
  // Расстояние и время — по дорогам от центра Батуми: если поля пустые или точка сменилась, а цифры остались прежними
  const movedSameRoad = !!old && (sight.lat !== old.lat || sight.lng !== old.lng)
    && sight.distance_km === old.distance_km && sight.drive_min === old.drive_min;
  if (sight.lat != null && sight.lng != null && ((sight.distance_km === null && sight.drive_min === null) || movedSameRoad)) {
    const road = await roadFromBatumi(sight.lat, sight.lng);
    if (road) Object.assign(sight, { distance_km: road.km, drive_min: road.min });
  }

  const saved: string[] = [];
  try {
    for (const f of filesFrom(form, "images")) saved.push(await saveImage(f, "sight"));
  } catch {
    await Promise.all(saved.map(removeImage));
    return fail(form, e.photo);
  }

  let sightId: number;
  try {
    sightId = db.transaction(() => {
      let sid = id;
      if (sid) {
        db.prepare(`UPDATE sights SET name=@name, region=@region, category=@category, description=@description,
          name_en=@name_en, region_en=@region_en, description_en=@description_en,
          car_type=@car_type, distance_km=@distance_km, drive_min=@drive_min, maps_url=@maps_url,
          lat=@lat, lng=@lng, is_published=@is_published, sort_order=@sort_order, updated_at=datetime('now') WHERE id=@id`).run({ ...sight, id: sid });
      } else {
        sid = Number(db.prepare(`INSERT INTO sights (name, region, category, description, name_en, region_en, description_en,
          car_type, distance_km, drive_min, maps_url, lat, lng, is_published, sort_order)
          VALUES (@name, @region, @category, @description, @name_en, @region_en, @description_en,
          @car_type, @distance_km, @drive_min, @maps_url, @lat, @lng, @is_published, @sort_order)`).run(sight).lastInsertRowid);
        assignSightSlugs(); // адрес страницы — из названия, один раз
      }
      const max = (db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM sight_images WHERE sight_id = ?").get(sid) as { m: number }).m;
      const ins = db.prepare("INSERT INTO sight_images (sight_id, file, sort_order) VALUES (?, ?, ?)");
      saved.forEach((file, i) => ins.run(sid, file, max + 1 + i));
      syncSightCover(sid);
      return sid;
    })();
  } catch {
    await Promise.all(saved.map(removeImage)); // загруженные фото без записи в БД не оставляем
    return fail(form, e.sightGone);
  }

  updateTag("sights");
  redirect(`/admin/sights?saved=${sightId}`);
}

function isGoogleMapsUrl(raw: string) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    if (u.hostname === "maps.app.goo.gl" || u.hostname === "maps.google.com") return true;
    if (u.hostname === "goo.gl") return u.pathname.startsWith("/maps");
    return /^(www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(u.hostname) && u.pathname.startsWith("/maps");
  } catch {
    return false;
  }
}

export async function deleteSight(id: number) {
  await requireAdmin();
  const sight = readSight(id);
  if (!sight) return;
  db.prepare("DELETE FROM sights WHERE id = ?").run(id); // sight_images удалятся каскадом
  await Promise.all(sight.images.map((i) => removeImage(i.file)));
  updateTag("sights");
  redirect("/admin/sights");
}

/** Обложка места (sights.image) — всегда первое фото галереи: по ней работают карточки и главная. */
function syncSightCover(sightId: number) {
  db.prepare(`UPDATE sights SET updated_at = datetime('now'),
    image = (SELECT file FROM sight_images WHERE sight_id = ? ORDER BY sort_order, id LIMIT 1) WHERE id = ?`).run(sightId, sightId);
}

export async function deleteSightImage(imageId: number) {
  await requireAdmin();
  const img = db.prepare("SELECT * FROM sight_images WHERE id = ?").get(imageId) as { file: string; sight_id: number } | undefined;
  if (!img) return;
  db.prepare("DELETE FROM sight_images WHERE id = ?").run(imageId);
  syncSightCover(img.sight_id);
  await removeImage(img.file);
  updateTag("sights");
}

/** Новый порядок фото места (перетаскивание в модалке); первое — главное. */
export async function reorderSightImages(sightId: number, imageIds: number[]) {
  await requireAdmin();
  const upd = db.prepare("UPDATE sight_images SET sort_order = ? WHERE id = ? AND sight_id = ?");
  db.transaction(() => {
    imageIds.forEach((id, i) => upd.run(i, id, sightId));
    syncSightCover(sightId);
  })();
  updateTag("sights");
}

// ── Фильтры: классы машин и направления мест ──

const categoryExists = (kind: "car" | "sight", key: string) => !!db.prepare("SELECT 1 FROM categories WHERE kind = ? AND key = ?").get(kind, key);
const kindOf = (form: FormData) => (str(form, "kind") === "sight" ? "sight" : "car");
/** Раздел, где живёт панель фильтров: машины — /admin, места — /admin/sights; ?filters=1 — панель раскрыта. */
const filtersUrl = (kind: "car" | "sight", q: string) => `${kind === "car" ? "/admin" : "/admin/sights"}?filters=1&${q}`;
/** Фильтры меняют подписи и на карточках, и в каталоге — сбрасываем кеш и того, и другого. */
const refreshCategories = (kind: "car" | "sight") => {
  updateTag("categories");
  updateTag(kind === "car" ? "cars" : "sights");
};

/** Новая категория или правка названий. Ключ для адреса создаётся один раз и не меняется; порядок — стрелками (moveCategory*). */
export async function saveCategory(form: FormData) {
  await requireAdmin();
  const kind = kindOf(form);
  const id = int(form, "id") || null;
  const name = str(form, "name");
  const name_en = str(form, "name_en");
  if (!name) redirect(filtersUrl(kind, "ferror=name"));
  if (id) {
    db.prepare("UPDATE categories SET name = ?, name_en = ? WHERE id = ? AND kind = ?").run(name, name_en, id, kind);
  } else {
    const base = slugify(name_en || name) || kind;
    let key = base;
    for (let n = 2; categoryExists(kind, key); n++) key = `${base}-${n}`;
    db.prepare(`INSERT INTO categories (kind, key, name, name_en, sort_order)
      VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM categories WHERE kind = ?))`).run(kind, key, name, name_en, kind);
  }
  refreshCategories(kind);
  redirect(filtersUrl(kind, `saved=${Date.now()}`));
}

/** Сдвинуть категорию на одну позицию: меняем местами с соседней и перенумеровываем раздел 0, 1, 2… */
function moveCategory(form: FormData, step: -1 | 1) {
  const kind = kindOf(form);
  const ids = (db.prepare("SELECT id FROM categories WHERE kind = ? ORDER BY sort_order, id").all(kind) as { id: number }[]).map((r) => r.id);
  const i = ids.indexOf(int(form, "id"));
  const j = i + step;
  if (i >= 0 && j >= 0 && j < ids.length) {
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const set = db.prepare("UPDATE categories SET sort_order = ? WHERE id = ?");
    db.transaction(() => ids.forEach((id, n) => set.run(n, id)))();
    refreshCategories(kind);
  }
  redirect(filtersUrl(kind, `saved=${Date.now()}`));
}

export async function moveCategoryUp(form: FormData) {
  await requireAdmin();
  moveCategory(form, -1);
}

export async function moveCategoryDown(form: FormData) {
  await requireAdmin();
  moveCategory(form, 1);
}

/** Удалить можно только пустой фильтр — иначе машины/места остались бы без класса. */
export async function deleteCategory(form: FormData) {
  await requireAdmin();
  const kind = kindOf(form);
  const cat = db.prepare("SELECT key FROM categories WHERE id = ? AND kind = ?").get(int(form, "id"), kind) as { key: string } | undefined;
  if (!cat) redirect(filtersUrl(kind, ""));
  const used = db.prepare(`SELECT 1 FROM ${kind === "car" ? "cars" : "sights"} WHERE category = ?`).get(cat.key);
  if (used) redirect(filtersUrl(kind, "ferror=used"));
  db.prepare("DELETE FROM categories WHERE id = ?").run(int(form, "id"));
  refreshCategories(kind);
  redirect(filtersUrl(kind, `saved=${Date.now()}`));
}

// ── Настройки сайта и владелец ──

// Тексты сайта (город, заголовки главной, валюта, автор фото) в админке не правятся — остаются как есть в БД.
// Instagram/Facebook теперь в общем списке соцсетей (socials).
const SETTING_KEYS = [
  "site_name", "brand_color",
  "phone", "whatsapp", "telegram", "email", "address", "address_en",
  "google_review_url", "google_place_id",
] as const; // пункты подачи — отдельной вкладкой, saveDelivery

const PHOTO_KEYS = { hero_image: "hero", logo: "logo" } as const;

export async function saveSettings(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const e = adminT(await getAdminLang()).errors;
  if (!str(form, "site_name") || !str(form, "phone")) return fail(form, e.siteRequired);
  form.set("whatsapp", str(form, "whatsapp").replace(/\D/g, ""));
  if (str(form, "google_review_url") && !/^https:\/\//.test(str(form, "google_review_url"))) return fail(form, e.https);
  if (str(form, "brand_color") && !/^#[0-9a-f]{6}$/i.test(str(form, "brand_color"))) return fail(form, e.color);
  // Соцсети: пары «название + ссылка» по порядку; пустые строки пропускаем
  const names = form.getAll("social_name").map((v) => String(v).trim());
  const urls = form.getAll("social_url").map((v) => String(v).trim());
  const socials = names.map((name, i) => ({ name, url: urls[i] ?? "" })).filter((x) => x.name || x.url);
  if (socials.some((x) => !x.name || !/^https:\/\//.test(x.url))) return fail(form, e.social);

  const saved: Partial<Record<keyof typeof PHOTO_KEYS, string>> = {};
  try {
    for (const [key, prefix] of Object.entries(PHOTO_KEYS) as [keyof typeof PHOTO_KEYS, string][]) {
      const [photo] = filesFrom(form, key);
      if (photo) saved[key] = await saveImage(photo, prefix, key === "logo" ? 400 : undefined);
    }
  } catch {
    await Promise.all(Object.values(saved).map(removeImage));
    return fail(form, e.photo);
  }

  const old = readSettings();
  const set = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  db.transaction(() => {
    for (const k of SETTING_KEYS) set.run(k, str(form, k));
    set.run("socials", JSON.stringify(socials));
    if (form.get("logo_remove") && !saved.logo) set.run("logo", "");
    for (const [k, file] of Object.entries(saved)) set.run(k, file);
  })();
  await Promise.all(Object.keys(saved).map((k) => removeImage(old[k as keyof typeof PHOTO_KEYS])));
  if (form.get("logo_remove") && !saved.logo) await removeImage(old.logo);

  updateTag("settings");
  redirect("/admin/settings?saved=1");
}

// ── Подача автомобиля ──

/** Пункты подачи таблицей (поле points — JSON строк формы): пустые строки пропускаем, у пункта нужно название, цена ≥ 0. */
export async function saveDelivery(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const e = adminT(await getAdminLang()).errors;
  let rows: { name?: unknown; name_en?: unknown; price?: unknown }[] = [];
  try {
    rows = JSON.parse(str(form, "points") || "[]");
  } catch {
    rows = [];
  }
  const points = (Array.isArray(rows) ? rows : [])
    .map((r) => ({ name: String(r.name ?? "").trim(), name_en: String(r.name_en ?? "").trim(), price: String(r.price ?? "").trim() }))
    .filter((r) => r.name || r.name_en || r.price);
  if (points.some((p) => !p.name)) return { error: e.pickupName };
  if (points.some((p) => p.price && !(Number(p.price) >= 0))) return { error: e.pickupPrice };
  db.prepare("UPDATE settings SET value = ? WHERE key = 'pickup_points'")
    .run(JSON.stringify(points.map((p) => ({ name: p.name, name_en: p.name_en, price: Number(p.price) || 0 }))));
  updateTag("settings");
  redirect("/admin/delivery?saved=1");
}

// ── Отзывы Google ──

export async function syncReviews(): Promise<FormState & { ok?: string }> {
  await requireAdmin();
  const result = await syncGoogleReviews(await getAdminLang());
  if (!result.ok) return { error: result.message };
  updateTag("reviews");
  updateTag("settings");
  return { ok: result.message };
}

// ── Брони (заявки с сайта) ──

// Переходы и удаление — общие с Telegram-ботом (src/lib/bookings.ts)
export async function setBookingStatus(id: number, status: BookingStatus) {
  await requireAdmin("bookings");
  if (!changeStatus(id, status)) return;
  updateTag("bookings"); // занятость машин на сайте (брони в работе)
  refresh(); // список и счётчик в шапке — заново
}

export async function deleteBooking(id: number) {
  await requireAdmin("bookings");
  if (!removeBooking(id)) return;
  updateTag("bookings");
  refresh();
}
