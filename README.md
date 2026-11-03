# AvtoNik — сайт аренды автомобилей в Батуми

Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind 4, SQLite (better-sqlite3).

```
 браузер ──> src/proxy.ts ──┬─ /admin/*  без сессии -> /admin/login
                            └─ /cars/x   несуществующий slug -> HTTP 404
   ├─ /                главная: машины, достопримечательности (-> Google Maps), владелец
   ├─ /cars/[slug]     страница машины (JSON-LD Car + Offer + BreadcrumbList)
   ├─ /uploads/[file]  фото из data/uploads
   ├─ /sitemap.xml, /robots.txt
   └─ /admin           CRUD: машины, достопримечательности, владелец/контакты
                       server actions -> data/autonik.db -> updateTag() -> сайт обновлён сразу
```

## Запуск локально

```bash
npm install
cp .env.example .env.local   # заполнить SESSION_SECRET, ADMIN_PASSWORD
npm run import               # наполнить БД данными AvtoNik (~10 минут, качает фото)
npm run dev                  # http://localhost:3000, админка: /admin
```

`npm run import` берёт: машины и цены — из API старого сайта autonik.rentals (+ правки названий
`scripts/data/cars.json`), достопримечательности — `scripts/data/sights.json` (список Google Maps
«Автопробег по Аджарии»), фото мест и главного экрана — Wikimedia Commons (автор и лицензия сохраняются),
контакты — `scripts/data/site.json`. Повторный запуск безопасен: докачивает недостающие фото и не затирает
правки из админки. Начать с нуля: удалить папку `data/` и запустить импорт снова.

## Отзывы Google

Рейтинг, число отзывов и до 5 отзывов берутся из официального Google Places API (New):
1. Google Cloud Console → включить **Places API (New)** → создать API-ключ → `GOOGLE_PLACES_API_KEY` в `.env.local`.
2. Админка → «Настройки сайта» → «Обновить отзывы из Google» (место находится по ссылке «Оставить отзыв»).
3. На сервере — автообновление раз в сутки (cron):
   `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://домен/api/reviews/sync`

## Проверка

```bash
# тест меняет данные, поэтому — на копии БД и с локальным моком Google Places
npm run build
rm -rf /tmp/autonik-e2e && cp -r data /tmp/autonik-e2e
DATA_DIR=/tmp/autonik-e2e GOOGLE_PLACES_API_KEY=test GOOGLE_PLACES_API_BASE=http://127.0.0.1:3999 npx next start -p 3100
python3 scripts/e2e.py        # сайт, SEO-разметка, вход, CRUD, фото, цены, отзывы, защита server actions
```

## SEO

- Каждая машина — отдельный URL `/cars/<марка>-<модель>-<год>` с уникальными title/description/canonical/OG.
- Название машины везде одно: `Марка Модель Год` (H1, title, alt фото, JSON-LD) — функция `carName()`.
- JSON-LD: `AutoRental` + `ItemList` на главной, `Car` с `Offer` (цена за сутки, `UnitPriceSpecification`) и
  `BreadcrumbList` на странице машины, `TouristAttraction` с `GeoCoordinates` и `hasMap` для достопримечательностей.
- `sitemap.xml` и `robots.txt` (админка закрыта от индексации), `lang="ru"`, честный 404 для удалённых машин.
- На проде задать `SITE_URL=https://домен` и коды `GOOGLE_SITE_VERIFICATION` / `YANDEX_VERIFICATION`.
