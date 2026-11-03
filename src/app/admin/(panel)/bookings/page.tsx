import { BookingsList } from "@/components/admin/BookingsList";
import { requireAdmin } from "@/lib/session";

// Админка рендерится на каждый запрос за сессией; задаётся на странице, т.к. ответ server action учитывает конфиг страницы.
export const instant = false;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function BookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  await requireAdmin("bookings");
  return <BookingsList q={one((await searchParams).q).trim().toLowerCase()} />;
}
