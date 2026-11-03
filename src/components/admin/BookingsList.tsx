import Link from "next/link";
import { deleteBooking, setBookingStatus } from "@/app/admin/actions";
import { ConfirmButton, btnOutline } from "@/components/admin/ui";
import { adminT } from "@/lib/admin-i18n";
import { getAdminLang } from "@/lib/admin-lang";
import { NEXT, bookingTotal, canDelete, nights } from "@/lib/bookings";
import { readBookings, readSettings, type BookingStatus } from "@/lib/data";
import { formatPrice, whatsappUrl } from "@/lib/format";
import { LOCALE_TAG, type Lang } from "@/lib/i18n";

const STATUS: Record<BookingStatus, string> = {
  new: "bg-brand text-white",
  confirmed: "bg-green-700 text-white",
  done: "bg-slate-500 text-white",
  cancelled: "bg-sand-line text-sand-ink",
};


const fmt = (d: string, lang: Lang) => new Date(`${d}T00:00:00Z`).toLocaleDateString(LOCALE_TAG[lang], { day: "numeric", month: "short", timeZone: "UTC" });
const created = (s: string, lang: Lang) => new Date(`${s.replace(" ", "T")}Z`).toLocaleString(LOCALE_TAG[lang], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tbilisi" });

/** Список броней с кнопками статусов — вкладка «Брони» админки и мини-апп Telegram (/admin/tg). q — поиск. */
export async function BookingsList({ q = "" }: { q?: string }) {
  const lang = await getAdminLang();
  const a = adminT(lang);
  const t = a.bookings;
  const all = readBookings();
  const { currency } = readSettings();
  const total = (b: (typeof all)[number]) => {
    const sum = bookingTotal(b);
    return sum != null ? formatPrice(sum, currency, lang) : null;
  };
  const list = q ? all.filter((b) => `${b.name} ${b.phone} ${b.car_name} ${b.comment} ${b.pickup}`.toLowerCase().includes(q)) : all;

  return (
    <>
      <ul className="space-y-3">
        {list.map((b) => (
          <li key={b.id} className={`rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-sand-line ${b.status === "cancelled" || b.status === "done" ? "opacity-70" : ""}`}>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <div className="w-56">
                <p className="flex items-center gap-2">
                  <span className="truncate font-bold">{b.name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS[b.status]}`}>{t.status[b.status]}</span>
                </p>
                <a href={`tel:${b.phone.replace(/[^\d+]/g, "")}`} className="block text-sm font-semibold text-ink hover:text-brand">{b.phone}</a>
                <a href={whatsappUrl(b.phone, `Здравствуйте, ${b.name}! Это AvtoNik, по вашей заявке на ${b.car_name}.`)} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-semibold text-green-700 hover:underline">{t.whatsapp}</a>
              </div>
              <div className="min-w-56 flex-1 text-sm">
                <p className="text-base font-bold">
                  {b.car_id ? <Link href={`/admin?edit=${b.car_id}`} className="hover:text-brand">{b.car_name}</Link> : b.car_name}
                  <span className="font-semibold text-sand-ink"> · #{b.id}</span>
                </p>
                <p className="font-semibold">{fmt(b.date_from, lang)} → {fmt(b.date_to, lang)} <span className="text-sand-ink">· {t.nights(nights(b.date_from, b.date_to))}</span></p>
                {b.pickup && <p>📍 {b.pickup}</p>}
                <p className="text-xs text-sand-ink">{t.created(created(b.created_at, lang), b.lang.toUpperCase())}</p>
              </div>
              {total(b) && <p className="text-2xl font-extrabold text-brand">{total(b)}</p>}
              <div className="flex flex-wrap gap-2">
                {NEXT[b.status].map(([status, label]) => (
                  <form key={status} action={setBookingStatus.bind(null, b.id, status)}>
                    <button className={status === "confirmed" || status === "done" ? "rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white hover:bg-black" : btnOutline}>{t[label]}</button>
                  </form>
                ))}
                {canDelete(b.status) && (
                  <ConfirmButton action={deleteBooking.bind(null, b.id)} message={t.confirmDelete(b.name)}>{a.delete}</ConfirmButton>
                )}
              </div>
            </div>
            {b.comment && <p className="mt-3 whitespace-pre-line rounded-lg bg-sand-field px-3 py-2 text-sm ring-1 ring-sand-line">{b.comment}</p>}
          </li>
        ))}
      </ul>
      {list.length === 0 && (
        <p className="py-16 text-center text-sand-ink">
          {q ? a.notFound : t.empty}
        </p>
      )}
    </>
  );
}
