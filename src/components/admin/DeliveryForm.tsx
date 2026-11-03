"use client";

import { useActionState, useState } from "react";
import { saveDelivery } from "@/app/admin/actions";
import type { PickupPoint } from "@/lib/format";
import { useAdminT } from "./AdminLang";
import { FormError, SubmitButton } from "./ui";

const input = "w-full rounded-lg border border-sand-line bg-sand-field px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const iconBtn = "grid size-8 shrink-0 place-items-center rounded-lg text-base font-bold transition disabled:cursor-not-allowed disabled:opacity-30";
// Телефон: названия RU/EN в ряд, под ними цена и удаление; с sm — одна строка
const grid = "grid grid-cols-2 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8.5rem_2rem]";

type Row = { name: string; name_en: string; price: string };
const toRow = (p: PickupPoint): Row => ({ name: p.name, name_en: p.name_en, price: p.price ? String(p.price) : "" });

/**
 * Пункты подачи таблицей: название RU/EN и доплата (одна на оба языка, пусто или 0 — бесплатно).
 * Строки живут в состоянии React и уходят одним полем points (JSON) — при ошибке сохранения ничего не теряется.
 */
export function DeliveryForm({ points, currency }: { points: PickupPoint[]; currency: string }) {
  const [state, action] = useActionState(saveDelivery, undefined);
  const t = useAdminT();
  const d = t.delivery;
  const [rows, setRows] = useState<Row[]>(points.length ? points.map(toRow) : [{ name: "", name_en: "", price: "" }]);
  const edit = (i: number, k: keyof Row, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <form action={action} className="space-y-4">
      <FormError error={state?.error} />
      <input type="hidden" name="points" value={JSON.stringify(rows)} />
      <div className={`${grid} whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-sand-ink max-sm:hidden`} aria-hidden="true">
        <span>{d.name}</span><span>{d.nameEn}</span><span>{d.price(currency)}</span><span />
      </div>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className={`${grid} rounded-xl bg-sand-field/60 p-2 ring-1 ring-sand-line sm:bg-transparent sm:p-0 sm:ring-0`}>
            <input value={r.name} onChange={(e) => edit(i, "name", e.target.value)} aria-label={d.name} placeholder={d.name} className={input} />
            <input value={r.name_en} onChange={(e) => edit(i, "name_en", e.target.value)} aria-label={d.nameEn} placeholder={d.nameEn} className={input} />
            <input value={r.price} onChange={(e) => edit(i, "price", e.target.value)} aria-label={d.price(currency)} placeholder={d.free}
              type="number" min={0} step="any" inputMode="decimal" className={`${input} ${r.price && Number(r.price) > 0 ? "" : "placeholder:text-green-700"}`} />
            <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={d.remove} title={d.remove}
              className={`${iconBtn} justify-self-end text-red-600 hover:bg-red-50`}>×</button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setRows([...rows, { name: "", name_en: "", price: "" }])}
        className="w-full rounded-xl border border-dashed border-sand-line px-4 py-2.5 text-sm font-semibold text-sand-ink hover:border-ink hover:text-ink">
        + {d.add}
      </button>
      <p className="text-xs text-sand-ink">{d.hint}</p>
      <SubmitButton>{t.save}</SubmitButton>
    </form>
  );
}
