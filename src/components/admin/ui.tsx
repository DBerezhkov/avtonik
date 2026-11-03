"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { label as dictLabel } from "@/lib/format";
import { useAdminLang, useAdminT } from "./AdminLang";
import type { Category } from "@/lib/data";

// UI-кит админки в песочной палитре (по образцу старой админки autonik.rentals).

export const inputCls =
  "mt-1.5 w-full rounded-xl border border-sand-line bg-sand-field px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";
const labelCls = "block text-[11px] font-bold uppercase tracking-wider text-sand-ink";

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string };

export function Field({ label, hint, className, ...props }: FieldProps) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className={labelCls}>{label}</span>
      <input {...props} className={inputCls} />
      {hint && <span className="mt-1 block text-xs text-sand-ink">{hint}</span>}
    </label>
  );
}

type AreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string };

export function Area({ label, hint, className, ...props }: AreaProps) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className={labelCls}>{label}</span>
      <textarea rows={4} {...props} className={inputCls} />
      {hint && <span className="mt-1 block text-xs text-sand-ink">{hint}</span>}
    </label>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: Record<string, { label: string; en: string }> };

/** Фильтры из БД -> справочник для Select (английское название пустое — русское). */
export const categoryOptions = (cats: Category[]) => Object.fromEntries(cats.map((c) => [c.key, { label: c.name, en: c.name_en || c.name }]));

/** Выпадающий список по справочнику (CATEGORIES, FUELS…): подписи — на языке интерфейса админки. */
export function Select({ label, options, ...props }: SelectProps) {
  const lang = useAdminLang();
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <select {...props} className={inputCls}>
        {Object.keys(options).map((k) => (
          <option key={k} value={k}>{dictLabel(options, k, lang)}</option>
        ))}
      </select>
    </label>
  );
}

/** Переключатель «Статус» (checkbox): подпись меняется вместе с положением — «Доступна» / «Скрыта». */
export function Toggle({ label, on, off, name, defaultChecked }: { label: string; on: string; off: string; name: string; defaultChecked: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <label className="mt-3 inline-flex cursor-pointer items-center gap-3">
        <input type="checkbox" name={name} checked={checked} onChange={(e) => setChecked(e.target.checked)} className="peer sr-only" />
        <span className="relative h-6 w-11 rounded-full bg-sand-line transition after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-green-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-brand" />
        <span className="text-sm font-bold uppercase tracking-wide text-ink">{checked ? on : off}</span>
      </label>
    </div>
  );
}

/** Заголовок раздела формы: «ФОТОГРАФИИ», «ОСНОВНАЯ ИНФОРМАЦИЯ»… */
export function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-sand-ink">{title}</h3>
      {children}
    </section>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  const t = useAdminT();
  return (
    <button type="submit" disabled={pending} className="rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-black disabled:opacity-60">
      {pending ? t.saving : children}
    </button>
  );
}

export function FormError({ error }: { error?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  // Кнопка «Сохранить» внизу, ошибка вверху формы — прокручиваем к ней
  useEffect(() => { if (error) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [error]);
  return error ? <p ref={ref} role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</p> : null;
}

export const btnOutline = "rounded-xl border border-sand-line bg-white px-4 py-2.5 text-center text-sm font-semibold text-ink hover:border-ink";
export const btnDanger = "rounded-xl border border-red-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-red-600 hover:bg-red-50";

/** Кнопка удаления с подтверждением; action — server action с уже привязанным id. */
export function ConfirmButton({ action, children, message, className }: { action: () => Promise<void>; children: React.ReactNode; message: string; className?: string }) {
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(message)) e.preventDefault(); }} className={className}>
      <button type="submit" className={`w-full ${btnDanger}`}>{children}</button>
    </form>
  );
}

/**
 * Модальное окно поверх сетки. Открыто, пока в адресе есть ?edit= / ?new=; закрывается ссылкой closeHref
 * (крестик, «Отмена», Esc, клик по фону). Внутри — форма целиком: шапка, прокручиваемое тело, футер.
 */
export function Modal({ title, closeHref, children }: { title: string; closeHref: string; children: React.ReactNode }) {
  const router = useRouter();
  const t = useAdminT();
  const leave = t.leave;
  const dirty = useRef(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (!dirty.current || confirm(leave)) router.push(closeHref, { scroll: false });
    };
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Фон (шапка с поиском) недоступен с клавиатуры, пока открыта модалка
    const header = document.querySelector("header");
    header?.setAttribute("inert", "");
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      header?.removeAttribute("inert");
    };
  }, [router, closeHref, leave]);
  // Крестик, «Отмена» и клик по фону — ссылки data-close: при несохранённых правках спрашиваем
  const guard = (e: React.MouseEvent) => {
    if (dirty.current && (e.target as HTMLElement).closest("a[data-close]") && !confirm(leave)) e.preventDefault();
  };
  return (
    <div onClickCapture={guard} onInput={() => { dirty.current = true; }} onChange={() => { dirty.current = true; }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <Link href={closeHref} scroll={false} data-close aria-label={t.close} className="fixed inset-0 cursor-default" />
      <div role="dialog" aria-modal="true" aria-label={title}
        className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
        <div className="flex items-center justify-between gap-4 border-b border-sand-line px-4 py-4 sm:px-6 sm:py-5">
          <h2 className="truncate text-lg font-extrabold text-ink">{title}</h2>
          <Link href={closeHref} scroll={false} data-close aria-label={t.close} className="grid size-9 place-items-center rounded-full text-xl text-ink hover:bg-sand">×</Link>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Тело и футер модалки — внутри <form>, чтобы кнопки футера отправляли её. */
export function ModalBody({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 space-y-7 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">{children}</div>;
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 border-t border-sand-line bg-white px-4 py-3 sm:px-6 sm:py-4">{children}</div>;
}
