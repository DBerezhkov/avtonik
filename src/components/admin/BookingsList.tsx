import Link from "next/link";
import { setBookingStatus } from "@/app/admin/actions";
import { ReviewMenu } from "@/components/admin/ReviewMenu";
import { btnOutline } from "@/components/admin/ui";
import { adminT } from "@/lib/admin-i18n";
import { getAdminLang } from "@/lib/admin-lang";
import { NEXT, archived, bookingTotal, clientHistory, nights } from "@/lib/bookings";
import { readBookings, readSettings, type Booking, type BookingStatus } from "@/lib/data";
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

/** Список броней с кнопками статусов — вкладка «Брони» админки и мини-апп Telegram (/admin/tg). q — поиск.
 *  Выполненные и отклонённые — в свёрнутом «Архиве» внизу (при поиске раскрыт); удалять брони нельзя. */
export async function BookingsList({ q = "" }: { q?: string }) {
  const lang = await getAdminLang();
  const a = adminT(lang);
  const t = a.bookings;
  const all = readBookings();
  const { currency } = readSettings();
  const total = (b: Booking) => {
    const sum = bookingTotal(b);
    return sum != null ? formatPrice(sum, currency, lang) : null;
  };
  const list = q ? all.filter((b) => `${b.name} ${b.phone} ${b.car_name} ${b.comment} ${b.pickup} ${b.review_note}`.toLowerCase().includes(q)) : all;
  const active = list.filter((b) => !archived(b.status));
  const archive = list.filter((b) => archived(b.status));

  const item = (b: Booking) => {
    const h = clientHistory(b, all);
    const warn = h && h.bad > 0 && !archived(b.status); // активная заявка от клиента с плохим опытом — красная рамка и плашка
    return (
          <li key={b.id} className={`rounded-2xl bg-white px-5 py-4 shadow-sm ${warn ? "ring-2 ring-red-500" : "ring-1 ring-sand-line"}`}>
            {warn && (
              <div role="alert" className="mb-3 rounded-lg bg-red-600 px-3 py-2 text-sm font-bold text-white">
                {t.badWarning(h.bad)}
                {h.badNotes.slice(0, 3).map((n, i) => <p key={i} className="font-semibold">«{n}»</p>)}
              </div>
            )}
            <div className="flex items-start gap-3">
            <div className={`flex flex-1 flex-wrap items-center gap-x-8 gap-y-3 ${archived(b.status) ? "opacity-70" : ""}`}>
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
              </div>
            </div>
            <ReviewMenu id={b.id} review={b.review} note={b.review_note} />
            </div>
            {h && (
              <p className="mt-2 text-sm font-semibold">
                <span className="text-sand-ink">{t.history(h.count)}{h.good > 0 && ` · 👍 ${h.good}`}</span>
                {h.bad > 0 && !warn && <span className="text-red-700"> · {t.historyBad(h.bad)}{h.badNotes[0] && ` — ${h.badNotes[0]}`}</span>}
              </p>
            )}
            {b.comment && <p className="mt-3 whitespace-pre-line rounded-lg bg-sand-field px-3 py-2 text-sm ring-1 ring-sand-line">{b.comment}</p>}
            {(b.review || b.review_note) && (
              <p className={`mt-3 whitespace-pre-line rounded-lg px-3 py-2 text-sm ring-1 ${b.review === "bad" ? "bg-red-50 text-red-800 ring-red-200" : b.review === "good" ? "bg-green-50 text-green-900 ring-green-200" : "bg-sand-field ring-sand-line"}`}>
                {b.review && <b>{t.review[b.review]}</b>}{b.review && b.review_note && " — "}{b.review_note}
              </p>
            )}
          </li>
    );
  };

  return (
    <>
      <ul className="space-y-3">{active.map(item)}</ul>
      {archive.length > 0 && (
        <details open={!!q} className="mt-8 rounded-2xl bg-white/60 p-4 ring-1 ring-sand-line">
          <summary className="cursor-pointer text-lg font-bold">{t.archive(archive.length)}</summary>
          <p className="mb-3 mt-1 text-sm text-sand-ink">{t.archiveHint}</p>
          <ul className="space-y-3">{archive.map(item)}</ul>
        </details>
      )}
      {list.length === 0 && (
        <p className="py-16 text-center text-sand-ink">
          {q ? a.notFound : t.empty}
        </p>
      )}
    </>
  );
}
