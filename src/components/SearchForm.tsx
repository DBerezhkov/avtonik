"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { path, t, type Lang } from "@/lib/i18n";
import { DateRangePicker, ymd } from "./DateRangePicker";
import { TypeSelect } from "./TypeSelect";

/**
 * Поиск на главной: даты аренды и класс авто -> /cars с фильтром.
 * Пустые поля в адрес не попадают: ничего не выбрано — просто /cars без фильтра.
 * Без JS форма просто открывает /cars (фильтр в каталоге применяется на клиенте).
 */
export function SearchForm({ types, lang }: { types: [string, string][]; lang: Lang }) {
  const d = t(lang).search;
  const cars = path(lang, "/cars");
  const router = useRouter();
  const [range, setRange] = useState<DateRange>();
  const [type, setType] = useState("");
  // Даты уходят в поиск только парой: одна дата без второй — как будто не выбраны
  const from = range?.from && range.to ? ymd(range.from) : "";
  const to = range?.from && range.to ? ymd(range.to) : "";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams(Object.entries({ type, from, to }).filter(([, v]) => v));
    router.push(q.size ? `${cars}?${q}` : cars);
  };

  const field = "block w-full rounded-xl bg-slate-100 px-4 py-3 text-base font-semibold text-fg outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-brand";
  // Подписи полей — как плейсхолдеры внутри; отдельная подпись только для экранных читалок
  const caption = "sr-only";

  return (
    <form action={cars} method="get" onSubmit={submit} aria-label={d.aria}
      className="relative grid gap-4 rounded-3xl bg-surface p-5 text-fg shadow-2xl ring-1 ring-slate-200 md:grid-cols-[1fr_1fr_1fr_auto] md:items-center md:p-6">
      <DateRangePicker lang={lang} value={range} onChange={setRange} fieldClass={field} captionClass={caption} />
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <TypeSelect lang={lang} types={types} value={type} onChange={setType} fieldClass={field} captionClass={caption} />
      <input type="hidden" name="type" value={type} />
      <button type="submit" className="rounded-xl bg-brand px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-brand/30 hover:bg-brand-dark">
        {d.submit}
      </button>
    </form>
  );
}
