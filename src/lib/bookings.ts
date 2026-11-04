import "server-only";
import { db } from "./db";
import { readCar, type Booking, type BookingStatus, type ClientReview } from "./data";
import { rentalPrice } from "./format";

/**
 * Путь заявки — общий для админки и Telegram-бота:
 * новая -> «Подтвердить» (договорились, статус «В работе») или «Отклонить»; в работе -> «Вернули машину» (выполнена).
 * Выполненная и отклонённая уходят в архив; удалить бронь нельзя — по ней видна история клиента.
 */
export type Step = "confirm" | "cancel" | "returned";
export const NEXT: Record<BookingStatus, [BookingStatus, Step][]> = {
  new: [["confirmed", "confirm"], ["cancelled", "cancel"]],
  confirmed: [["done", "returned"]],
  done: [],
  cancelled: [],
};
export const archived = (s: BookingStatus) => s === "done" || s === "cancelled";

export const nights = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

export function readBooking(id: number) {
  return db.prepare("SELECT * FROM bookings WHERE id = ?").get(id) as Booking | undefined;
}

/** Сумма — по текущим ценам машины за срок (как на сайте) плюс подача; машину удалили — суммы нет. */
export function bookingTotal(b: Booking) {
  const car = b.car_id ? readCar(b.car_id) : undefined;
  return car ? rentalPrice(car, nights(b.date_from, b.date_to)).total + b.pickup_price : null;
}

/** Сменить статус, если такой переход разрешён из текущего (устаревшая кнопка ничего не сломает). */
export function changeStatus(id: number, to: BookingStatus) {
  const b = readBooking(id);
  if (!b || !NEXT[b.status].some(([s]) => s === to)) return false;
  db.prepare("UPDATE bookings SET status = ? WHERE id = ?").run(to, id);
  return true;
}

/** Отзыв админа о клиенте по брони: оценка и комментарий. */
export function setReview(id: number, review: ClientReview, note: string) {
  if (!["", "good", "bad"].includes(review)) return false;
  return db.prepare("UPDATE bookings SET review = ?, review_note = ? WHERE id = ?").run(review, note.trim().slice(0, 2000), id).changes > 0;
}

/** Клиент — номер телефона; сравниваем по последним 9 цифрам: +995 555 11 22 33 = 555112233 = 8 555 11-22-33. */
const phoneKey = (phone: string) => phone.replace(/\D/g, "").slice(-9);

export type ClientHistory = { count: number; good: number; bad: number; badNotes: string[] };

/** Другие заявки с этого номера: сколько было и отзывы админа. Нет других — null. all — уже прочитанные брони (список в админке). */
type Past = Pick<Booking, "id" | "phone" | "review" | "review_note">;
export function clientHistory(b: Pick<Booking, "id" | "phone">, all?: Past[]): ClientHistory | null {
  const key = phoneKey(b.phone);
  if (key.length < 6) return null;
  all ??= db.prepare("SELECT id, phone, review, review_note FROM bookings ORDER BY created_at DESC, id DESC").all() as Past[];
  const rows = all.filter((r) => r.id !== b.id && phoneKey(r.phone) === key);
  if (!rows.length) return null;
  const bad = rows.filter((r) => r.review === "bad");
  return {
    count: rows.length,
    good: rows.filter((r) => r.review === "good").length,
    bad: bad.length,
    badNotes: bad.map((r) => r.review_note).filter(Boolean),
  };
}
