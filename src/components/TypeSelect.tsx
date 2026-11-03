"use client";

import { t, type Lang } from "@/lib/i18n";
import { usePopover } from "./usePopover";

/** «Тип автомобиля»: поле-кнопка и выпадающий список прямо под ним. */
export function TypeSelect({ lang, types, value, onChange, fieldClass, captionClass }: {
  lang: Lang;
  types: [string, string][];
  value: string;
  onChange: (v: string) => void;
  fieldClass: string;
  captionClass: string;
}) {
  const d = t(lang).search;
  const { open, setOpen, ref } = usePopover<HTMLDivElement>();
  const options: [string, string][] = [["", d.any], ...types];
  // Пока тип не выбран, в поле — подпись «Тип автомобиля» как плейсхолдер
  const current = value ? options.find(([k]) => k === value)?.[1] : undefined;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open} className="block w-full text-left">
        <span className={captionClass}>{d.type}</span>
        <span className={`${fieldClass} flex items-center justify-between gap-2 ${open ? "ring-2 ring-brand" : ""} ${current ? "" : "text-slate-400"}`}>
          <span className="truncate">{current ?? d.type}</span>
          <svg viewBox="0 0 24 24" className={`size-5 shrink-0 text-brand transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 rounded-2xl bg-surface p-2 text-fg shadow-2xl ring-1 ring-slate-200">
          <ul role="listbox" aria-label={d.type} className="grid gap-1">
            {options.map(([k, l]) => (
              <li key={k || "any"} role="option" aria-selected={k === value}>
                <button type="button" onClick={() => { onChange(k); setOpen(false); }}
                  className={`w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition ${
                    k === value ? "bg-brand text-white" : "text-fg hover:bg-slate-100"}`}>
                  {l}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
