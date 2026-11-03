import "server-only";
import { db } from "./db";
import { readCar, type Booking, type BookingStatus } from "./data";
import { rentalPrice } from "./format";

/**
 * Путь заявки — общий для админки и Telegram-бота:
 * новая -> «Подтвердить» (договорились, статус «В работе») или «Отклонить»; в работе -> «Вернули машину» (выполнена).
 * Выполненную и отклонённую можно только удалить.
 */
export type Step = "confirm" | "cancel" | "returned";
export const NEXT: Record<BookingStatus, [BookingStatus, Step][]> = {
  new: [["confirmed", "confirm"], ["cancelled", "cancel"]],
  confirmed: [["done", "returned"]],
  done: [],
  cancelled: [],
};
export const canDelete = (s: BookingStatus) => s === "done" || s === "cancelled";

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

/** Удалить можно только выполненную или отклонённую. */
export function removeBooking(id: number) {
  const b = readBooking(id);
  if (!b || !canDelete(b.status)) return false;
  db.prepare("DELETE FROM bookings WHERE id = ?").run(id);
  return true;
}
