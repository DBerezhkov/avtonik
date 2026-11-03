"use client";

import { useSearchParams } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { createBooking } from "@/app/booking-actions";
import { formatPrice, overlapsBusy, rentalPrice, type Busy, type Pickup, type Priced } from "@/lib/format";
import { t, type Lang } from "@/lib/i18n";
import { DateRangePicker, ymd } from "./DateRangePicker";
import { PickupSelect } from "./PickupSelect";

/** YYYY-MM-DD -> локальная дата (как в календаре); undefined для пустого или кривого значения. */
function parseYmd(v: string | null) {
  const m = v && /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : undefined;
}

type Props = { carId: number; lang: Lang; prices: Priced; currency: string; pickups: Pickup[] };

/** Форма с датами из адреса (?from=&to= — так приходят из каталога). useSearchParams — только внутри Suspense,
 *  поэтому на странице она обёрнута в Suspense с обычной BookingForm в fallback (форма есть и в HTML). */
export function BookingFormFromUrl(props: Props) {
  const params = useSearchParams();
  const from = parseYmd(params.get("from")), to = parseYmd(params.get("to"));
  return <BookingForm {...props} initial={from && to && to > from ? { from, to } : undefined} />;
}

/** Заявка на бронирование на странице машины: имя, телефон, даты, комментарий -> админка, вкладка «Брони».
 *  При выбранных датах показывает итог по ценам за срок. */
export function BookingForm({ carId, lang, prices, currency, pickups, initial }: Props & { initial?: DateRange }) {
  const all = t(lang);
  const d = all.booking;
  const [state, action, pending] = useActionState(createBooking, undefined);
  const [range, setRange] = useState<DateRange | undefined>(initial);
  // Занятые даты — свежие с сервера при каждом открытии (страница машины статична и кешируется)
  const [busy, setBusy] = useState<Busy[]>([]);
  useEffect(() => {
    fetch(`/api/busy?car=${carId}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])).then(setBusy, () => {});
  }, [carId]);
  // Сутки — по календарным датам (Math.round гасит час перехода на летнее время)
  const days = range?.from && range.to ? Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000) : 0;
  // Даты пересекаются с подтверждённой бронью — предупреждаем и не даём отправить (сервер проверит ещё раз)
  const taken = days > 0 && overlapsBusy(busy, ymd(range!.from!), ymd(range!.to!));
  const price = days > 0 && !taken ? rentalPrice(prices, days) : null;
  const v = (k: string) => state?.values?.[k] ?? "";
  // Место подачи: платное прибавляется к итогу
  const [pickupIdx, setPickupIdx] = useState(v("pickup"));
  const pickup = pickupIdx === "" ? undefined : pickups[Number(pickupIdx)];

  if (state?.ok) {
    return <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800 ring-1 ring-green-200">{d.done}</p>;
  }

  const field = "block w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-fg outline-none ring-1 ring-slate-200 placeholder:font-normal placeholder:text-slate-400 focus:ring-2 focus:ring-brand";
  return (
    <form action={action} className="space-y-3">
      <p className="font-bold">{d.title}</p>
      {state?.error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">{state.error}</p>}
      <DateRangePicker lang={lang} value={range} onChange={setRange} fieldClass={field} captionClass="sr-only" className="grid-cols-2 gap-2" compact busy={busy} />
      {taken && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">{d.errors.busy}</p>}
      {pickups.length > 0 && (
        <PickupSelect pickups={pickups} value={pickupIdx} onChange={setPickupIdx} label={d.pickup} fieldClass={field} currency={currency} lang={lang} />
      )}
      {price && (
        <div className="rounded-xl bg-brand/10 px-4 py-3 text-sm">
          {pickup && pickup.price > 0 && (
            <>
              <p className="flex justify-between gap-3"><span>{all.days(days)} × {formatPrice(price.perDay, currency, lang)}</span><span>{formatPrice(price.total, currency, lang)}</span></p>
              <p className="flex justify-between gap-3"><span>{d.pickupFee}</span><span>+{formatPrice(pickup.price, currency, lang)}</span></p>
            </>
          )}
          <p className="flex items-baseline justify-between">
            <span>{pickup && pickup.price > 0 ? "" : <>{all.days(days)} × {formatPrice(price.perDay, currency, lang)}</>}</span>
            <strong className="text-lg">{formatPrice(price.total + (pickup?.price ?? 0), currency, lang)}</strong>
          </p>
        </div>
      )}
      <input type="hidden" name="car_id" value={carId} />
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="from" value={range?.from && range.to ? ymd(range.from) : ""} />
      <input type="hidden" name="to" value={range?.from && range.to ? ymd(range.to) : ""} />
      <input name="name" defaultValue={v("name")} required minLength={2} maxLength={80} autoComplete="name" placeholder={d.name} aria-label={d.name} className={field} />
      <input name="phone" type="tel" defaultValue={v("phone")} required maxLength={30} autoComplete="tel" placeholder={d.phone} aria-label={d.phone} className={field} />
      <textarea name="comment" defaultValue={v("comment")} rows={2} maxLength={1000} placeholder={d.commentPlaceholder} aria-label={d.comment} className={field} />
      {/* ловушка для ботов: людям не видна */}
      {/* Имя без смысла для автозаполнения: поле «website» браузер заполнял сам, и заявки живых людей отсеивались как спам */}
      <input name="hp_x7" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] size-px opacity-0" />
      <button type="submit" disabled={pending || taken} className="block w-full rounded-full bg-brand px-6 py-3 text-center font-bold text-white hover:bg-brand-dark disabled:opacity-60">
        {pending ? d.sending : d.submit}
      </button>
    </form>
  );
}
