"use client";

import { usePathname } from "next/navigation";
import { path, stripLang, t, type Lang } from "@/lib/i18n";

/**
 * EN / RU: та же страница на другом языке — обычной загрузкой страницы, а не клиентской навигацией.
 * /ru и / — один корневой layout с разным [lang]: при клиентском переходе React собирает страницу заново,
 * и картинки с оформлением моргают по отдельности. При обычной загрузке браузер держит старую страницу
 * до готовности новой и подменяет её разом.
 */
export function LangSwitch({ lang }: { lang: Lang }) {
  const rest = stripLang(usePathname());
  const other: Lang = lang === "en" ? "ru" : "en";
  const href = path(other, rest);
  return (
    // Фильтр и даты каталога (?type=&from=&to=) и якорь сохраняем при переключении: читаем их в момент клика
    <a href={href} onClick={(e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || (!location.search && !location.hash)) return;
      e.preventDefault();
      location.assign(href + location.search + location.hash);
    }} hrefLang={other} lang={other} aria-label={t(lang).langSwitch}
      className="grid h-10 min-w-10 shrink-0 place-items-center rounded-full px-3 text-sm font-bold ring-1 ring-slate-200 hover:ring-brand">
      {other.toUpperCase()}
    </a>
  );
}
