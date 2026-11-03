// Заполняет английские версии текстов (*_en) из scripts/data/translations-en.json.
// Пишет только в пустые поля — правки из админки не затирает. Повторный запуск безопасен.
//   node scripts/apply-translations.mjs            (DATA_DIR — как у приложения)
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const db = new Database(path.join(DATA_DIR, "autonik.db"));
const tr = JSON.parse(fs.readFileSync(new URL("./data/translations-en.json", import.meta.url), "utf8"));

// Колонки *_en (как в src/lib/db.ts) — на случай, если приложение ещё не запускалось на этой БД
const ADDED = [["cars", "description_en"], ["cars", "features_en"], ["sights", "name_en"], ["sights", "region_en"], ["sights", "route_en"], ["sights", "description_en"]];
for (const [t, c] of ADDED) {
  if (!db.prepare(`PRAGMA table_info(${t})`).all().some((x) => x.name === c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} TEXT NOT NULL DEFAULT ''`);
}

let n = 0;
const missed = [];
db.transaction(() => {
  const set = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE settings.value = ''`);
  for (const [k, v] of Object.entries(tr.settings)) n += set.run(`${k}_en`, v).changes;

  const car = db.prepare("UPDATE cars SET description_en = ? WHERE description = ? AND description_en = ''");
  const hasCar = db.prepare("SELECT 1 FROM cars WHERE description = ?");
  for (const [ru, en] of Object.entries(tr.car_descriptions)) {
    if (!hasCar.get(ru)) missed.push(`машина: «${ru.slice(0, 50)}…»`);
    n += car.run(en, ru).changes;
  }

  const sight = db.prepare(`UPDATE sights SET
    name_en = CASE WHEN name_en = '' THEN @name ELSE name_en END,
    region_en = CASE WHEN region_en = '' THEN @region ELSE region_en END,
    route_en = CASE WHEN route_en = '' THEN @route ELSE route_en END,
    description_en = CASE WHEN description_en = '' THEN @description ELSE description_en END
    WHERE name = @ru AND (name_en = '' OR region_en = '' OR route_en = '' OR description_en = '')`);
  const hasSight = db.prepare("SELECT 1 FROM sights WHERE name = ?");
  for (const [ru, en] of Object.entries(tr.sights)) {
    if (!hasSight.get(ru)) missed.push(`место: ${ru}`);
    n += sight.run({ ...en, ru }).changes;
  }
})();
console.log(`Переводы применены: ${n} записей`);
// Русский текст в БД изменили — перевод по нему не найден: впишите английский в админке
if (missed.length) console.log(`Не найдены в БД (${missed.length}):\n  ${missed.join("\n  ")}`);
if (n) console.log("Сайт кеширует данные: перезапустите сервер (или сохраните что-нибудь в админке), чтобы переводы появились.");
