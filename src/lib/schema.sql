-- Схема БД. Применяется приложением (src/lib/db.ts) и скриптом импорта (scripts/import-autonik.mjs).

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cars (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id     INTEGER UNIQUE,              -- id машины на старом сайте autonik.rentals (для повторного импорта)
  slug          TEXT NOT NULL UNIQUE,
  brand         TEXT NOT NULL,
  model         TEXT NOT NULL,
  year          INTEGER NOT NULL,
  category      TEXT NOT NULL DEFAULT 'midsize',
  body_type     TEXT NOT NULL DEFAULT '',
  transmission  TEXT NOT NULL DEFAULT 'automatic',
  fuel          TEXT NOT NULL DEFAULT 'petrol',
  engine        TEXT NOT NULL DEFAULT '',
  drive         TEXT NOT NULL DEFAULT '',
  seats         INTEGER NOT NULL DEFAULT 5,
  doors         INTEGER NOT NULL DEFAULT 4,
  luggage       INTEGER NOT NULL DEFAULT 2,
  color         TEXT NOT NULL DEFAULT '',
  price_per_day INTEGER NOT NULL,            -- базовая цена за сутки
  price_1_3     INTEGER,                     -- цены за сутки по сроку аренды (NULL — не задано)
  price_4_7     INTEGER,
  price_8_30    INTEGER,
  price_30_plus INTEGER,
  deposit       INTEGER NOT NULL DEFAULT 0,
  min_days      INTEGER NOT NULL DEFAULT 1,
  description   TEXT NOT NULL DEFAULT '',
  features      TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',   -- английская версия (пусто — показывается русская)
  features_en   TEXT NOT NULL DEFAULT '',
  is_published  INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS car_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id     INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  file       TEXT NOT NULL,
  source_url TEXT,                           -- откуда скачано при импорте (чтобы докачивать недостающие)
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Дополнительные фото места (главное — sights.image); показываются галереей на странице места
CREATE TABLE IF NOT EXISTS sight_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  sight_id   INTEGER NOT NULL REFERENCES sights(id) ON DELETE CASCADE,
  file       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS car_images_car ON car_images(car_id, sort_order);

-- Старые адреса машин: proxy делает с них 308-редирект на актуальный URL (SEO).
CREATE TABLE IF NOT EXISTS car_slug_history (
  slug   TEXT PRIMARY KEY,
  car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE
);

-- Достопримечательности (места для поездок), каждая — отдельная карточка со ссылкой на Google Maps.
CREATE TABLE IF NOT EXISTS sights (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  google_cid   TEXT UNIQUE,                  -- id места в Google Maps (для повторного импорта)
  name         TEXT NOT NULL,
  region       TEXT NOT NULL DEFAULT '',
  route        TEXT NOT NULL DEFAULT '',     -- маршрут/тип дороги: «Горный маршрут (4x4 / SUV)» и т.п.
  description  TEXT NOT NULL DEFAULT '',
  name_en        TEXT NOT NULL DEFAULT '',   -- английская версия (пусто — показывается русская)
  region_en      TEXT NOT NULL DEFAULT '',
  route_en       TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  image        TEXT,
  image_credit TEXT NOT NULL DEFAULT '',     -- автор и лицензия фото (с Wikimedia Commons; на сайте больше не показывается)
  car_type     TEXT NOT NULL DEFAULT 'any',  -- какая машина нужна: any | crossover | awd (SIGHT_CARS в format.ts)
  distance_km  INTEGER,                      -- по дороге от центра Батуми (пусто — считается по координатам при сохранении)
  drive_min    INTEGER,                      -- время в пути от центра Батуми, минут
  maps_url     TEXT NOT NULL DEFAULT '',
  lat          REAL,
  lng          REAL,
  is_published INTEGER NOT NULL DEFAULT 1,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Отзывы из Google (Places API), обновляются синхронизацией.
CREATE TABLE IF NOT EXISTS reviews (
  id           TEXT PRIMARY KEY,             -- name отзыва в Places API
  author       TEXT NOT NULL,
  author_url   TEXT NOT NULL DEFAULT '',
  author_photo TEXT NOT NULL DEFAULT '',
  rating       INTEGER NOT NULL,
  text         TEXT NOT NULL DEFAULT '',
  relative_time TEXT NOT NULL DEFAULT '',
  published_at TEXT NOT NULL DEFAULT '',
  sort_order   INTEGER NOT NULL DEFAULT 0
);

-- Заявки на бронирование с сайта (форма на странице машины). Обрабатываются в админке, вкладка «Брони».
CREATE TABLE IF NOT EXISTS bookings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id     INTEGER REFERENCES cars(id) ON DELETE SET NULL,
  car_name   TEXT NOT NULL,                  -- название на момент заявки (машину могут удалить)
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  date_from  TEXT NOT NULL,                  -- YYYY-MM-DD
  date_to    TEXT NOT NULL,
  comment    TEXT NOT NULL DEFAULT '',
  lang       TEXT NOT NULL DEFAULT 'en',     -- язык сайта, с которого пришла заявка
  status     TEXT NOT NULL DEFAULT 'new',    -- new | confirmed | done | cancelled
  review     TEXT NOT NULL DEFAULT '',       -- отзыв админа о клиенте: '' | good | bad
  review_note TEXT NOT NULL DEFAULT '',      -- комментарий админа (вернул ли машину, в каком виде…)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS bookings_status ON bookings(status, created_at);

-- Фильтры каталога: классы машин (kind = 'car') и направления мест (kind = 'sight'); редактируются в админке
CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,                  -- car | sight
  key        TEXT NOT NULL,                  -- в адресе фильтра (?type=suv) и в cars.category / sights.category; не меняется
  name       TEXT NOT NULL,
  name_en    TEXT NOT NULL DEFAULT '',       -- пусто — на английском сайте русское название
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (kind, key)
);
