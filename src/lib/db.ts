import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { slugify } from "./format";

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

// Все ключи настроек должны существовать; содержимое — из импорта или админки.
const SETTING_KEYS = [
  "site_name", "city", "hero_title", "hero_subtitle", "hero_image", "hero_image_credit",
  "owner_name", "owner_about", "owner_photo", "phone", "whatsapp", "telegram", "email", "address",
  "instagram", "facebook", "currency", "delivery_info",
  "logo", "brand_color", "socials", // логотип в шапке, цвет темы (#rrggbb), соцсети — JSON [{name, url}]
  "pickup_points", // пункты подачи — JSON [{name, name_en, price}]; прежние delivery_info / delivery_info_en больше не используются
  "google_review_url", "google_place_id", "google_rating", "google_rating_count", "reviews_synced_at",
  // Английская версия текстов (пусто — на английском сайте показывается русский вариант)
  "city_en", "hero_title_en", "hero_subtitle_en", "owner_name_en", "owner_about_en", "address_en", "delivery_info_en",
];

// Колонки, добавленные после первого запуска: CREATE TABLE IF NOT EXISTS их в старую БД не добавит.
const ADDED_COLUMNS: [table: string, column: string, def?: string][] = [
  ["cars", "description_en"], ["cars", "features_en"],
  ["sights", "name_en"], ["sights", "region_en"], ["sights", "route_en"], ["sights", "description_en"],
  ["sights", "slug"],
  ["sights", "category"],
  ["sights", "car_type", "TEXT NOT NULL DEFAULT 'any'"], ["sights", "distance_km", "INTEGER"], ["sights", "drive_min", "INTEGER"],
  ["bookings", "pickup"], ["bookings", "pickup_price", "REAL NOT NULL DEFAULT 0"], // место подачи из заявки и доплата за него
];

// Классы машин на первый запуск (ключи — как на прежнем сайте, на них ссылки ?type=…); дальше — в админке, вкладка «Фильтры»
const DEFAULT_CAR_CATEGORIES: [key: string, name: string, name_en: string][] = [
  ["economy", "Эконом", "Economy"], ["compact", "Компакт", "Compact"], ["midsize", "Средний класс", "Midsize"],
  ["suv", "Кроссовер", "SUV"], ["minivan", "Минивэн", "Minivan"], ["luxury", "Премиум", "Premium"],
];

/** Первый запуск фильтров: классы машин по умолчанию; направления мест — из прежнего поля «Маршрут». */
function seedCategories(conn: Database.Database) {
  const has = (kind: string) => conn.prepare("SELECT 1 FROM categories WHERE kind = ?").get(kind);
  const ins = conn.prepare("INSERT OR IGNORE INTO categories (kind, key, name, name_en, sort_order) VALUES (?, ?, ?, ?, ?)");
  conn.transaction(() => {
    if (!has("car")) DEFAULT_CAR_CATEGORIES.forEach(([key, name, en], i) => ins.run("car", key, name, en, i));
    if (!has("sight")) {
      const routes = conn.prepare(`SELECT route, MAX(route_en) AS route_en FROM sights WHERE route <> ''
        GROUP BY route ORDER BY MIN(sort_order), MIN(id)`).all() as { route: string; route_en: string }[];
      const set = conn.prepare("UPDATE sights SET category = ? WHERE route = ? AND category = ''");
      routes.forEach((r, i) => {
        const key = slugify(r.route_en || r.route) || `area-${i + 1}`;
        ins.run("sight", key, r.route, r.route_en, i);
        set.run(key, r.route);
      });
    }
  })();
}

/** Адрес страницы места — из английского названия (иначе русского), один раз: при переименовании не меняется,
 *  чтобы ссылки и позиции в поиске не терялись. Одинаковые названия получают номер: -2, -3… */
export function assignSightSlugs(conn: Database.Database = db) {
  const taken = conn.prepare("SELECT 1 FROM sights WHERE slug = ?");
  const set = conn.prepare("UPDATE sights SET slug = ? WHERE id = ?");
  const rows = conn.prepare("SELECT id, name, name_en FROM sights WHERE slug = '' ORDER BY id").all() as { id: number; name: string; name_en: string }[];
  conn.transaction(() => {
    for (const r of rows) {
      const base = slugify(r.name_en || r.name) || `place-${r.id}`;
      let slug = base;
      for (let n = 2; taken.get(slug); n++) slug = `${base}-${n}`;
      set.run(slug, r.id);
    }
  })();
}

function open() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, "autonik.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(fs.readFileSync(path.join(process.cwd(), "src/lib/schema.sql"), "utf8"));
  for (const [table, column, def = "TEXT NOT NULL DEFAULT ''"] of ADDED_COLUMNS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  }
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS sights_slug ON sights(slug) WHERE slug <> ''");
  assignSightSlugs(db);
  seedCategories(db);
  // Раньше у места было одно фото (sights.image) — переносим его в галерею; дальше image = первое фото галереи
  db.exec(`INSERT INTO sight_images (sight_id, file, sort_order)
    SELECT id, image, 0 FROM sights s WHERE image IS NOT NULL AND image <> ''
      AND NOT EXISTS (SELECT 1 FROM sight_images i WHERE i.sight_id = s.id)`);
  const ins = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, '')");
  db.transaction(() => SETTING_KEYS.forEach((k) => ins.run(k)))();
  const get = (k: string) => (db.prepare("SELECT value FROM settings WHERE key = ?").get(k) as { value: string }).value;
  // Пункты подачи раньше были текстом «Место — $16» по строке, отдельно RU и EN — переносим в таблицу (цена — из русского списка)
  if (!get("pickup_points") && get("delivery_info")) {
    const lines = (k: string) => get(k).split("\n").map((l) => l.trim()).filter(Boolean);
    const en = lines("delivery_info_en");
    const points = lines("delivery_info").map((l, i) => {
      const [name, ...fee] = l.split(/\s+—\s+/);
      const price = fee.join(" ").match(/\d+(?:[.,]\d+)?/);
      return { name, name_en: en[i]?.split(/\s+—\s+/)[0] ?? "", price: price ? Number(price[0].replace(",", ".")) : 0 };
    });
    db.prepare("UPDATE settings SET value = ? WHERE key = 'pickup_points'").run(JSON.stringify(points));
  }
  // Соцсети раньше были двумя полями — переносим их в общий список (один раз, пока список пуст)
  if (!get("socials")) {
    const list = [["Instagram", get("instagram")], ["Facebook", get("facebook")]].filter(([, url]) => url).map(([name, url]) => ({ name, url }));
    if (list.length) db.prepare("UPDATE settings SET value = ? WHERE key = 'socials'").run(JSON.stringify(list));
  }
  return db;
}

// В dev-режиме модули перезагружаются — держим одно соединение на процесс.
const g = globalThis as unknown as { __db?: Database.Database };
export const db = g.__db ?? (g.__db = open());
