"use server";

import { after } from "next/server";
import { db } from "@/lib/db";
import { readBusy, readSettings } from "@/lib/data";
import { overlapsBusy, parsePickupPoints, pickupFee, pickupsFor } from "@/lib/format";
import { isLang, t } from "@/lib/i18n";
import { notifyNewBooking } from "@/lib/telegram";

export type BookingState = { ok?: boolean; error?: string; values?: Record<string, string> } | undefined;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const day = (v: string) => (DATE.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v ? Date.parse(`${v}T00:00:00Z`) : NaN);

/** Заявка на бронирование со страницы машины -> таблица bookings (админка, вкладка «Брони»). */
export async function createBooking(_prev: BookingState, form: FormData): Promise<BookingState> {
  const rawLang = String(form.get("lang") ?? "");
  const lang = isLang(rawLang) ? rawLang : "en";
  const carId = Number(form.get("car_id"));
  const e = t(lang).booking.errors;
  const str = (k: string) => String(form.get(k) ?? "").trim();
  const values = { name: str("name"), phone: str("phone"), from: str("from"), to: str("to"), comment: str("comment"), pickup: str("pickup") };
  const fail = (error: string): BookingState => ({ error, values });

  // Ловушка для ботов: скрытое поле люди не заполняют — делаем вид, что всё прошло
  if (str("hp_x7")) return { ok: true };

  const car = db.prepare("SELECT id, brand, model, year FROM cars WHERE id = ? AND is_published = 1").get(carId) as
    { id: number; brand: string; model: string; year: number } | undefined;
  if (!car) return fail(e.car);
  if (values.name.length < 2 || values.name.length > 80) return fail(e.name);
  if (values.phone.replace(/\D/g, "").length < 7 || values.phone.length > 30) return fail(e.phone);
  const from = day(values.from), to = day(values.to);
  const today = Date.now() - 36 * 3600_000; // запас на часовые пояса
  if (Number.isNaN(from) || Number.isNaN(to) || from < today || to <= from || to - from > 365 * 86_400_000) return fail(e.dates);
  if (values.comment.length > 1000) return fail(e.comment);
  if (overlapsBusy(readBusy()[car.id] ?? [], values.from, values.to)) return fail(e.busy);
  // Место подачи — по номеру из того же списка, что видел клиент (на его языке); список пуст — поле не спрашиваем
  const s = readSettings();
  const pickups = pickupsFor(parsePickupPoints(s.pickup_points), lang);
  const pickup = !pickups.length ? null : /^\d+$/.test(values.pickup) ? pickups[Number(values.pickup)] : undefined;
  if (pickup === undefined) return fail(e.pickup);

  const carName = `${car.brand} ${car.model} ${car.year}`;
  const pickupText = pickup ? `${pickup.place} — ${pickupFee(pickup, s.currency, lang)}` : "";
  const id = Number(db.prepare(`INSERT INTO bookings (car_id, car_name, name, phone, date_from, date_to, comment, pickup, pickup_price, lang)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(car.id, carName, values.name, values.phone, values.from, values.to,
    values.comment, pickupText, pickup?.price ?? 0, lang).lastInsertRowid);

  // Уведомление в Telegram (карточка с кнопками) — после ответа клиенту, чтобы форма не ждала
  after(() => notifyNewBooking(id));
  return { ok: true };
}
