"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { path, stripLang, t, type Lang } from "@/lib/i18n";

/** EN / RU: та же страница на другом языке. */
export function LangSwitch({ lang }: { lang: Lang }) {
  const rest = stripLang(usePathname());
  const router = useRouter();
  const other: Lang = lang === "en" ? "ru" : "en";
  const href = path(other, rest);
  return (
    // Фильтр и даты каталога (?type=&from=&to=) и якорь сохраняем при переключении: читаем их в момент клика
    <Link href={href} onClick={(e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || (!location.search && !location.hash)) return;
      e.preventDefault();
      router.push(href + location.search + location.hash);
    }} hrefLang={other} lang={other} aria-label={t(lang).langSwitch}
      className="grid h-10 min-w-10 shrink-0 place-items-center rounded-full px-3 text-sm font-bold ring-1 ring-slate-200 hover:ring-brand">
      {other.toUpperCase()}
    </Link>
  );
}
