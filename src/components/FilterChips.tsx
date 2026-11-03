"use client";

import { t, type Lang } from "@/lib/i18n";

/** Кнопки-фильтры. «Все» — value = null. */
export function FilterChips({ options, value, onChange, lang, before }: {
  options: [string, string, number][]; value: string | null; onChange: (v: string | null) => void; lang: Lang;
  before?: React.ReactNode; // доп. кнопка перед «Все» (в каталоге — «Свободные»)
}) {
  const total = options.reduce((n, [, , c]) => n + c, 0);
  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition ${active ? "bg-brand text-white" : "bg-surface text-slate-700 ring-1 ring-slate-200 hover:ring-brand"}`;
  return (
    <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label={t(lang).catalog.filter}>
      {before}
      <button type="button" className={chip(value === null)} aria-pressed={value === null} onClick={() => onChange(null)}>
        {t(lang).catalog.all} <span className="opacity-60">{total}</span>
      </button>
      {options.map(([key, label, count]) => (
        <button key={key} type="button" className={chip(value === key)} aria-pressed={value === key} onClick={() => onChange(key)}>
          {label} <span className="opacity-60">{count}</span>
        </button>
      ))}
    </div>
  );
}
