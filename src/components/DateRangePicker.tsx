"use client";

import { useSyncExternalStore } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { enUS, ru } from "react-day-picker/locale";
import "react-day-picker/style.css";
import type { Busy } from "@/lib/format";
import { LOCALE_TAG, t, type Lang } from "@/lib/i18n";
import { usePopover } from "./usePopover";

/** YYYY-MM-DD -> локальная дата (как в календаре). */
const local = (v: string) => new Date(+v.slice(0, 4), +v.slice(5, 7) - 1, +v.slice(8, 10));
/** Занятые сутки для календаря: дни строго внутри брони. День выдачи можно взять как день возврата и наоборот,
 *  их пересечение с бронью проверяет форма (overlapsBusy). */
const busyDays = (busy: Busy[]) =>
  busy.map((b) => ({ from: new Date(local(b.from).getTime() + 86_400_000), to: new Date(local(b.to).getTime() - 86_400_000) }))
    .filter((r) => r.to >= r.from);
/** Сутки, когда машина у клиента (от дня выдачи до дня перед возвратом), — в календаре перечёркнуты. */
const takenDays = (busy: Busy[]) =>
  busy.map((b) => ({ from: local(b.from), to: new Date(local(b.to).getTime() - 86_400_000) }));

/** Date -> YYYY-MM-DD по локальной дате пользователя (без сдвига в UTC). */
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const wideQuery = "(min-width: 768px)";
const subscribeWide = (cb: () => void) => {
  const m = matchMedia(wideQuery);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/**
 * Два поля «Дата получения / Дата возврата», открывающие общий календарь с выбором диапазона.
 * На широком экране — два месяца, на телефоне — один. Прошедшие дни недоступны.
 */
export function DateRangePicker({ lang, value, onChange, fieldClass, captionClass, className = "sm:grid-cols-2 md:col-span-2", compact, busy = [] }: {
  lang: Lang;
  value: DateRange | undefined;
  onChange: (v: DateRange | undefined) => void;
  fieldClass: string;
  captionClass: string;
  className?: string;
  /** Узкое место (боковая колонка): всегда один месяц, окно по правому краю */
  compact?: boolean;
  /** Подтверждённые брони машины — эти дни выбрать нельзя */
  busy?: Busy[];
}) {
  const d = t(lang).search;
  const { open, setOpen, ref: box } = usePopover<HTMLDivElement>();
  const wide = useSyncExternalStore(subscribeWide, () => matchMedia(wideQuery).matches, () => true);

  const fmt = (x?: Date) => x?.toLocaleDateString(LOCALE_TAG[lang], { day: "numeric", month: "short", weekday: "short" });
  const nights = value?.from && value?.to ? Math.round((value.to.getTime() - value.from.getTime()) / 86_400_000) : 0;
  const field = (label: string, date: Date | undefined, active: boolean) => (
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
      className={`block w-full text-left ${active && open ? "[&>span:last-child]:ring-2 [&>span:last-child]:ring-brand" : ""}`}>
      <span className={captionClass}>{label}</span>
      <span className={`${fieldClass} flex items-center gap-2 ${date ? "" : "text-slate-400"}`}>
        <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        <span className="truncate">{fmt(date) ?? label}</span>
      </span>
    </button>
  );

  return (
    // Календарь открывается прямо под полями дат
    <div ref={box} className={`relative grid gap-4 ${className}`}>
      {field(d.from, value?.from, !value?.from || !!value?.to)}
      {field(d.to, value?.to, !!value?.from && !value?.to)}
      {open && (
        <div role="dialog" aria-label={d.calendar}
          className={`rdp-brand absolute ${compact ? "right-0" : "left-0"} top-full z-40 mt-2 w-max max-w-[calc(100vw-2rem)] rounded-2xl bg-surface p-4 text-fg shadow-2xl ring-1 ring-slate-200`}>
          <p className="mb-2 text-sm font-semibold text-slate-500">{value?.from && !value.to ? d.hintTo : d.hintFrom}</p>
          <DayPicker
            mode="range"
            min={1}
            selected={value}
            onSelect={(r) => {
              onChange(r);
              if (r?.from && r?.to) setOpen(false); // диапазон выбран — закрываем
            }}
            numberOfMonths={wide && !compact ? 2 : 1}
            disabled={[{ before: new Date() }, ...busyDays(busy)]}
            excludeDisabled
            modifiers={{ taken: takenDays(busy) }}
            modifiersClassNames={{ taken: "rdp-taken" }}
            locale={lang === "ru" ? ru : enUS}
            weekStartsOn={1}
            defaultMonth={value?.from}
          />
          <div className="mt-3 flex items-center justify-between gap-4 border-t border-slate-200 pt-3 text-sm">
            <span className="font-semibold">
              {value?.from ? `${fmt(value.from)} — ${fmt(value.to) ?? "…"}` : ""}
              {nights > 0 && <span className="ml-2 text-slate-500">· {t(lang).days(nights)}</span>}
            </span>
            <span className="flex gap-2">
              {value?.from && (
                <button type="button" onClick={() => onChange(undefined)} className="rounded-full px-4 py-2 font-semibold text-slate-600 hover:text-brand">{d.clear}</button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-brand px-5 py-2 font-bold text-white hover:bg-brand-dark">{d.done}</button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
