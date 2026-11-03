// Первичное наполнение БД данными AvtoNik:
//   - машины и цены — из API старого сайта autonik.rentals (+ правки названий из scripts/data/cars.json);
//   - достопримечательности — scripts/data/sights.json (список Google Maps «Автопробег по Аджарии»);
//   - фото мест и главного экрана — Wikimedia Commons (свободные лицензии, автор сохраняется в БД);
//   - контакты и тексты — scripts/data/site.json, пункты подачи — из API.
//
// Запуск: npm run import
// Повторный запуск безопасен: существующие машины (source_id), места (google_cid)
// и непустые настройки не трогает — правки из админки не затираются.

import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const UPLOADS = path.join(DATA_DIR, "uploads");
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/data", f), "utf8"));
const UA = { "User-Agent": "AvtoNikSiteImport/1.0 (server@whatsbaufi.de)" };

fs.mkdirSync(UPLOADS, { recursive: true });
const db = new Database(path.join(DATA_DIR, "autonik.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(fs.readFileSync(path.join(ROOT, "src/lib/schema.sql"), "utf8"));

async function fetchJson(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(45_000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

/** Скачивает картинку (таймаут 45 с, 3 попытки) и сохраняет в data/uploads как webp (макс. 1920px, для hero — 2400px). */
async function saveImage(url, prefix, max = 1920) {
  let res;
  for (let attempt = 1; ; attempt++) {
    try {
      res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30_000) });
      if (res.ok) break;
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      // Фотохостинг (i.ibb.co) отвечает 503, когда ограничивает частоту, — не долбим его:
      // одна повторная попытка, остальное докачает следующий запуск npm run import.
      if (attempt === 2) throw new Error(`${url}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  const name = `${prefix}-${crypto.randomBytes(6).toString("hex")}.webp`;
  await sharp(Buffer.from(await res.arrayBuffer()))
    .rotate()
    .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(UPLOADS, name));
  return name;
}

/** Фото с Wikimedia Commons: URL нужного размера + подпись «автор, лицензия». */
async function commons(title, width) {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  Object.entries({
    action: "query", format: "json", titles: `File:${title}`, prop: "imageinfo",
    iiprop: "url|extmetadata", iiurlwidth: String(width),
  }).forEach(([k, v]) => u.searchParams.set(k, v));
  const page = Object.values((await fetchJson(u)).query.pages)[0];
  const info = page.imageinfo?.[0];
  if (!info) throw new Error(`Commons: нет файла ${title}`);
  const strip = (s) => (s ?? "").replace(/<[^>]+>/g, "").trim();
  const artist = strip(info.extmetadata?.Artist?.value) || "автор неизвестен";
  const license = strip(info.extmetadata?.LicenseShortName?.value);
  return { url: info.thumburl ?? info.url, credit: `${artist}, ${license} — Wikimedia Commons`, page: info.descriptionurl };
}

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function uniqueSlug(base) {
  let slug = base;
  for (let n = 2; db.prepare("SELECT 1 FROM cars WHERE slug = ?").get(slug); n++) slug = `${base}-${n}`;
  return slug;
}

// ── Настройки ──

const site = read("site.json");
const setIfEmpty = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE settings.value = ''`);
const getSetting = (k) => db.prepare("SELECT value FROM settings WHERE key = ?").get(k)?.value ?? "";

for (const [k, v] of Object.entries(site.settings)) setIfEmpty.run(k, v);

if (!getSetting("delivery_info")) {
  const points = (await fetchJson(site.sources.pickup_api)).filter((p) => p.active).sort((a, b) => a.sort_order - b.sort_order);
  const lines = points.map((p) => `${p.name_ru || p.name} — ${p.price > 0 ? `$${p.price}` : "бесплатно"}`);
  setIfEmpty.run("delivery_info", lines.join("\n"));
  console.log(`Пункты подачи: ${lines.length}`);
}

if (!getSetting("hero_image")) {
  const photo = await commons(site.hero_photo, 2400);
  setIfEmpty.run("hero_image", await saveImage(photo.url, "hero-adjara", 2400));
  setIfEmpty.run("hero_image_credit", photo.credit);
  console.log(`Главное фото: ${site.hero_photo}`);
}

// ── Машины ──

const FUEL = { Gasoline: "petrol", Petrol: "petrol", Diesel: "diesel", Hybrid: "hybrid", Electric: "electric" };
const CATEGORY = { Economy: "economy", Compact: "compact", Midsize: "midsize", SUV: "suv", Luxury: "luxury", Minivan: "minivan" };
const fixes = read("cars.json");
const apiCars = await fetchJson(site.sources.cars_api);

const insCar = db.prepare(`INSERT INTO cars (source_id, slug, brand, model, year, category, body_type, transmission, fuel,
  drive, seats, luggage, price_per_day, price_1_3, price_4_7, price_8_30, price_30_plus, description, sort_order)
  VALUES (@source_id, @slug, @brand, @model, @year, @category, @body_type, @transmission, @fuel,
  @drive, @seats, @luggage, @price_per_day, @price_1_3, @price_4_7, @price_8_30, @price_30_plus, @description, @sort_order)`);
const insImg = db.prepare("INSERT INTO car_images (car_id, file, source_url, sort_order) VALUES (?, ?, ?, ?)");

/** Докачивает фото машины, которых ещё нет в БД (по source_url), не больше limit. Последовательно — хостинги не любят параллель. */
async function syncPhotos(carId, slug, urls, limit = Infinity) {
  let ok = 0;
  for (const [n, url] of urls.entries()) {
    if (ok >= limit) break;
    if (db.prepare("SELECT 1 FROM car_images WHERE car_id = ? AND source_url = ?").get(carId, url)) continue;
    try {
      insImg.run(carId, await saveImage(url, slug), url, n);
      ok++;
    } catch (e) {
      console.warn(`  ! фото не скачалось (${slug}): ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return ok;
}

let added = 0;
for (const [i, c] of apiCars.entries()) {
  // Чужие стоковые фото (сайты-обзорщики) не берём — только фото самого проката.
  const urls = [...new Set([c.image, ...(c.gallery ?? [])].filter(Boolean))].filter((u) => !/usnews\.com/.test(u));
  const existing = db.prepare("SELECT id, slug FROM cars WHERE source_id = ?").get(c.id);
  if (existing) {
    // Повторный запуск: докачиваем только машинам совсем без фото, одного достаточно.
    const hasPhoto = db.prepare("SELECT 1 FROM car_images WHERE car_id = ?").get(existing.id);
    if (!hasPhoto && (await syncPhotos(existing.id, existing.slug, urls, 1))) console.log(`Докачано фото: ${existing.slug}`);
    continue;
  }
  const fix = fixes[String(c.id)] ?? {};
  const [brand, ...rest] = c.name.trim().split(/\s+/);
  const car = {
    source_id: c.id,
    brand: fix.brand ?? brand,
    model: fix.model ?? rest.join(" "),
    year: c.year,
    category: fix.category ?? CATEGORY[c.category] ?? "midsize",
    body_type: fix.body_type ?? "",
    transmission: /manual/i.test(c.transmission) ? "manual" : "automatic",
    fuel: FUEL[c.fuelType] ?? "petrol",
    drive: fix.drive ?? "",
    seats: c.seats || 5,
    luggage: c.luggage ?? 0,
    price_per_day: c.price,
    price_1_3: c.price_1_3 ?? null,
    price_4_7: c.price_4_7 ?? null,
    price_8_30: c.price_8_30 ?? null,
    price_30_plus: c.price_30_plus ?? null,
    // Описания вида «Good car» / повтор названия — не контент, такие пропускаем.
    description: (() => {
      const d = (c.description ?? "").replace(/\u200b/g, "").trim();
      return d.length >= 25 ? d : "";
    })(),
    sort_order: i,
  };
  car.slug = uniqueSlug(slugify(`${car.brand}-${car.model}-${car.year}`));
  const id = insCar.run(car).lastInsertRowid;
  const got = await syncPhotos(id, car.slug, urls);
  added++;
  console.log(`Машина: ${car.brand} ${car.model} ${car.year} -> /cars/${car.slug} (${got}/${urls.length} фото)`);
}
console.log(`Машин добавлено: ${added} из ${apiCars.length}`);
const missing = db.prepare("SELECT COUNT(*) AS n FROM cars c WHERE NOT EXISTS (SELECT 1 FROM car_images i WHERE i.car_id = c.id)").get().n;
if (missing) console.log(`Внимание: ${missing} машин без фото — запустите npm run import ещё раз, чтобы докачать.`);

// ── Достопримечательности ──

const sights = Object.entries(read("sights.json")).filter(([k]) => !k.startsWith("_"));
const insSight = db.prepare(`INSERT INTO sights (google_cid, name, region, route, description, image, image_credit,
  maps_url, lat, lng, sort_order) VALUES (@google_cid, @name, @region, @route, @description, @image, @image_credit,
  @maps_url, @lat, @lng, @sort_order)`);

added = 0;
for (const [i, [cid, s]] of sights.entries()) {
  if (db.prepare("SELECT 1 FROM sights WHERE google_cid = ?").get(cid)) continue;
  let image = null;
  let image_credit = "";
  if (s.photo) {
    try {
      const photo = await commons(s.photo, 1600);
      image = await saveImage(photo.url, "sight");
      image_credit = photo.credit;
    } catch (e) {
      console.warn(`  ! фото не скачалось (${s.name}): ${e.message}`);
    }
  }
  insSight.run({
    google_cid: cid, name: s.name, region: s.region, route: s.route, description: s.description,
    image, image_credit, maps_url: `https://maps.google.com/?cid=${cid}`, lat: s.lat, lng: s.lng, sort_order: i,
  });
  added++;
  console.log(`Место: ${s.name}${image ? "" : " (без фото)"}`);
}
console.log(`Мест добавлено: ${added} из ${sights.length}`);
