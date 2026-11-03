"use client";

import { pickupFee, type Pickup } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import { usePopover } from "./usePopover";

/** Плашка цены: бесплатно — зелёная, платно — «+$16». */
function Fee({ p, currency, lang, active }: { p: Pickup; currency: string; lang: Lang; active?: boolean }) {
  const cls = active ? "bg-white/20 text-white" : p.price ? "bg-brand/10 text-brand" : "bg-green-100 text-green-700";
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>{p.price ? "+" : ""}{pickupFee(p, currency, lang)}</span>;
}

const pin = (
  <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" />
  </svg>
);

/** «Где заберёте машину»: поле-кнопка и список пунктов подачи с ценой. Значение — номер пункта в поле pickup. */
export function PickupSelect({ pickups, value, onChange, label, fieldClass, currency, lang }: {
  pickups: Pickup[];
  value: string;
  onChange: (v: string) => void;
  label: string;
  fieldClass: string;
  currency: string;
  lang: Lang;
}) {
  const { open, setOpen, ref } = usePopover<HTMLDivElement>();
  const current = value === "" ? undefined : pickups[Number(value)];

  return (
    <div ref={ref} className="relative">
      {/* Обязательное поле формы: без выбора браузер покажет подсказку у кнопки (readOnly отключил бы проверку — поэтому onChange-заглушка) */}
      <input name="pickup" value={value} onChange={() => {}} required tabIndex={-1} aria-hidden="true"
        onInvalid={() => setOpen(true)} className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0" />
      <button type="button" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open} aria-label={label} className="block w-full text-left">
        <span className={`${fieldClass} flex items-center gap-2 ${open ? "ring-2 ring-brand" : ""} ${current ? "" : "text-slate-400"}`}>
          {pin}
          <span className="flex-1 truncate">{current ? current.place : label}</span>
          {current && <Fee p={current} currency={currency} lang={lang} />}
          <svg viewBox="0 0 24 24" className={`size-5 shrink-0 text-brand transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 rounded-2xl bg-surface p-2 text-fg shadow-2xl ring-1 ring-slate-200">
          <ul role="listbox" aria-label={label} className="grid gap-1">
            {pickups.map((p, i) => {
              const active = String(i) === value;
              return (
                <li key={p.place} role="option" aria-selected={active}>
                  <button type="button" onClick={() => { onChange(String(i)); setOpen(false); }}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition ${
                      active ? "bg-brand text-white" : "text-fg hover:bg-slate-100"}`}>
                    <span>{p.place}</span>
                    <Fee p={p} currency={currency} lang={lang} active={active} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
