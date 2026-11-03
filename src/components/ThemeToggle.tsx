"use client";

import { t, type Lang } from "@/lib/i18n";

/** Переключатель светлой/тёмной темы. Иконка выбирается CSS-классом .dark, поэтому состояния в React нет. */
export function ThemeToggle({ className, lang = "ru" }: { className?: string; lang?: Lang }) {
  function toggle() {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {}
  }
  return (
    <button type="button" onClick={toggle} aria-label={t(lang).theme.aria} title={t(lang).theme.title}
      className={`grid size-10 shrink-0 place-items-center rounded-full ring-1 ring-slate-200 hover:ring-brand ${className ?? ""}`}>
      {/* луна — в светлой теме, солнце — в тёмной */}
      <svg viewBox="0 0 24 24" className="size-5 dark:hidden" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      <svg viewBox="0 0 24 24" className="hidden size-5 dark:block" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
