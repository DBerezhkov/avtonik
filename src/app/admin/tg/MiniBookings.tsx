import Link from "next/link";
import { deleteBooking, setBookingStatus } from "@/app/admin/actions";
import { DeleteButton } from "./DeleteButton";
import { adminT } from "@/lib/admin-i18n";
import { NEXT, bookingTotal, canDelete, nights } from "@/lib/bookings";
import { db } from "@/lib/db";
import { readSettings, type Booking, type BookingStatus } from "@/lib/data";
import { formatPrice, whatsappUrl } from "@/lib/format";
import { LOCALE_TAG, type Lang } from "@/lib/i18n";

const ORDER: BookingStatus[] = ["new", "confirmed", "done", "cancelled"];
const DOT: Record<BookingStatus, string> = { new: "bg-brand", confirmed: "bg-green-600", done: "bg-slate-400", cancelled: "bg-sand-line" };
const day = (v: string, lang: Lang) => new Date(`${v}T00:00:00Z`).toLocaleDateString(LOCALE_TAG[lang], { day: "numeric", month: "short", timeZone: "UTC" });

/** Мини-апп Telegram: брони под телефон — вкладки статусов, компактные карточки, крупные кнопки. status — открытая вкладка. */
export function MiniBookings({ lang, status }: { lang: Lang; status?: string }) {
  const t = adminT(lang);
  const b = t.bookings;
  const { currency } = readSettings();
  const counts = Object.fromEntries((db.prepare("SELECT status, COUNT(*) n FROM bookings GROUP BY status").all() as { status: string; n: number }[])
    .map((r) => [r.status, r.n])) as Partial<Record<BookingStatus, number>>;
  // По умолчанию — «Новые», если они есть, иначе «В работе»
  const active: BookingStatus = ORDER.includes(status as BookingStatus) ? (status as BookingStatus) : counts.new ? "new" : "confirmed";
  const list = db.prepare("SELECT * FROM bookings WHERE status = ? ORDER BY date_from, id").all(active) as Booking[];

  return (
    <div className="min-h-screen bg-sand pb-8 text-ink">
      <header className="sticky top-0 z-10 border-b border-sand-line bg-sand/95 px-3 pb-2 pt-3 backdrop-blur">
        <h1 className="mb-2 text-lg font-extrabold tracking-tight">Avto<span className="text-brand">Nik</span> <span className="text-sand-ink">· {t.header.tabs.bookings}</span></h1>
        <nav className="grid grid-cols-4 gap-1 rounded-xl bg-[#ebe3d5] p-1">
          {ORDER.map((s) => (
            <Link key={s} href={`/admin/tg?s=${s}`} replace scroll={false} aria-current={s === active ? "page" : undefined}
              className={`flex flex-col items-center rounded-lg py-1.5 text-[11px] font-bold leading-tight ${s === active ? "bg-white text-ink shadow-sm" : "text-sand-ink"}`}>
              <span className={`text-base font-extrabold ${s === "new" && counts.new ? "text-brand" : ""}`}>{counts[s] ?? 0}</span>
              {t.tg.tabs[s]}
            </Link>
          ))}
        </nav>
      </header>

      <ul className="space-y-2 px-3 pt-3">
        {list.map((x) => {
          const total = bookingTotal(x);
          return (
            <li key={x.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-sand-line">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-extrabold">
                    <span className={`size-2 shrink-0 rounded-full ${DOT[x.status]}`} aria-hidden="true" />
                    <span className="truncate">{x.car_name}</span>
                  </p>
                  <p className="mt-0.5 text-sm font-semibold">{day(x.date_from, lang)} → {day(x.date_to, lang)} <span className="text-sand-ink">· {b.nights(nights(x.date_from, x.date_to))}</span></p>
                </div>
                {total != null && <p className="shrink-0 text-lg font-extrabold text-brand">{formatPrice(total, currency, lang)}</p>}
              </div>
              <div className="mt-2 space-y-0.5 text-sm">
                <p><span className="font-bold">{x.name}</span> <span className="text-sand-ink">· #{x.id}</span></p>
                {x.pickup && <p className="text-sand-ink">📍 {x.pickup}</p>}
                {x.comment && <p className="whitespace-pre-line rounded-lg bg-sand-field px-2.5 py-1.5 ring-1 ring-sand-line">{x.comment}</p>}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a href={`tel:${x.phone.replace(/[^\d+]/g, "")}`} className="flex h-10 items-center justify-center rounded-xl border border-sand-line bg-sand-field text-sm font-bold">
                  📞 {x.phone}
                </a>
                <a href={whatsappUrl(x.phone, `Здравствуйте, ${x.name}! Это AvtoNik, по вашей заявке на ${x.car_name}.`)} target="_blank" rel="noopener noreferrer"
                  className="flex h-10 items-center justify-center rounded-xl bg-[#25D366] text-sm font-bold text-white">WhatsApp</a>
              </div>
              {(NEXT[x.status].length > 0 || canDelete(x.status)) && (
                <div className="mt-2 flex gap-2">
                  {NEXT[x.status].map(([to, step]) => (
                    <form key={to} action={setBookingStatus.bind(null, x.id, to)} className="flex-1">
                      <button className={`h-11 w-full rounded-xl text-sm font-bold ${step === "cancel" ? "border border-sand-line bg-white text-ink" : "bg-ink text-white"}`}>{b[step]}</button>
                    </form>
                  ))}
                  {canDelete(x.status) && <DeleteButton action={deleteBooking.bind(null, x.id)} label={t.delete} sure={t.tg.sure} />}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <p className="px-6 py-16 text-center text-sand-ink">{t.tg.empty}</p>}
    </div>
  );
}
