"use client";

import { deleteCategory, moveCategoryDown, moveCategoryUp, saveCategory } from "@/app/admin/actions";
import type { Category } from "@/lib/data";
import { useAdminT } from "./AdminLang";

export type FilterRow = Category & { count: number };

const input = "w-full rounded-lg border border-sand-line bg-sand-field px-3 py-1.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
const iconBtn = "grid size-8 shrink-0 place-items-center rounded-lg text-base font-bold transition disabled:cursor-not-allowed disabled:opacity-30";

/**
 * Фильтры раздела (классы машин или направления мест) — сворачиваемая панель над сеткой:
 * строка на категорию (название, EN, стрелки порядка, сколько записей, сохранить/удалить) и строка добавления.
 * open — раскрыть сразу (после сохранения или ошибки в панели).
 */
export function FilterPanel({ kind, rows, open, error }: { kind: Category["kind"]; rows: FilterRow[]; open: boolean; error?: string }) {
  const t = useAdminT().filters;
  // Телефон: два ряда — названия RU/EN, под ними порядок и кнопки; с sm — одна строка
  const grid = "grid grid-cols-2 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4.5rem_5.5rem_auto]";
  return (
    <details open={open} className="mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-sand-line">
      <summary className="cursor-pointer select-none text-sm font-bold text-ink">
        {t.title}
      </summary>
      <p className="mt-2 text-xs text-sand-ink">{t.lead}</p>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">{error === "used" ? t.errUsed : t.errName}</p>}

      <div className={`${grid} mt-3 px-1 text-[11px] font-bold uppercase tracking-wider text-sand-ink max-sm:hidden`} aria-hidden="true">
        <span>{t.name}</span><span>{t.nameEn}</span><span className="text-center">{t.order}</span><span className="hidden sm:block" /><span />
      </div>
      <ul className="mt-1 space-y-1.5">
        {rows.map((c, i) => (
          <li key={c.id}>
            <form action={saveCategory} className={grid}>
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="id" value={c.id} />
              <input name="name" defaultValue={c.name} required aria-label={t.name} className={input} />
              <input name="name_en" defaultValue={c.name_en} aria-label={t.nameEn} className={input} />
              <span className="flex justify-center gap-1">
                <button type="submit" formAction={moveCategoryUp} formNoValidate disabled={i === 0} aria-label={t.up} title={t.up}
                  className={`${iconBtn} bg-sand text-ink hover:bg-ink hover:text-white`}>↑</button>
                <button type="submit" formAction={moveCategoryDown} formNoValidate disabled={i === rows.length - 1} aria-label={t.down} title={t.down}
                  className={`${iconBtn} bg-sand text-ink hover:bg-ink hover:text-white`}>↓</button>
              </span>
              <span className="hidden text-xs text-sand-ink sm:block">{t.items(c.count)}</span>
              <span className="flex justify-end gap-1">
                <button type="submit" aria-label={t.save} title={t.save} className={`${iconBtn} bg-sand text-ink hover:bg-brand hover:text-white`}>✓</button>
                <button type="submit" formAction={deleteCategory} formNoValidate disabled={c.count > 0} aria-label={t.delete}
                  title={c.count > 0 ? t.deleteUsed : t.delete} className={`${iconBtn} text-red-600 hover:bg-red-50`}
                  onClick={(e) => { if (!confirm(`${t.delete}: «${c.name}»?`)) e.preventDefault(); }}>
                  ×
                </button>
              </span>
            </form>
          </li>
        ))}
      </ul>
      <form action={saveCategory} className={`${grid} mt-3 border-t border-sand-line pt-3`}>
        <input type="hidden" name="kind" value={kind} />
        <input name="name" required aria-label={t.name} placeholder={t.name} className={input} />
        <input name="name_en" aria-label={t.nameEn} placeholder={t.nameEn} className={input} />
        <button type="submit" className="col-span-2 rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-white hover:bg-brand-dark sm:col-span-3">+ {t.add}</button>
      </form>
    </details>
  );
}
