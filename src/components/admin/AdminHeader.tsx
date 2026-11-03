"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { logout, setAdminLang } from "@/app/admin/actions";
import { useAdminLang, useAdminT } from "./AdminLang";

const TABS = [
  { href: "/admin", key: "cars" },
  { href: "/admin/bookings", key: "bookings" },
  { href: "/admin/delivery", key: "delivery" },
  { href: "/admin/sights", key: "sights" },
] as const;
const SETTINGS = "/admin/settings";

const ICON = { viewBox: "0 0 24 24", className: "size-5", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const iconBtn = (active: boolean) =>
  `grid size-11 place-items-center rounded-xl transition ${active ? "bg-white text-ink shadow-sm" : "text-sand-ink hover:bg-white/70 hover:text-ink"}`;

/** Поиск по карточкам текущей вкладки: пишет ?q= в адрес (с задержкой), фильтрует сервер. */
function SearchBox({ placeholder, label }: { placeholder: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQ = params.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Адрес сменился извне (сохранение, «Назад», клик по вкладке) — поле показывает то, что в адресе
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ);
  if (urlQ !== prevUrlQ) {
    setPrevUrlQ(urlQ);
    setQ(urlQ);
  }
  const change = (v: string) => {
    setQ(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => router.replace(v ? `${pathname}?q=${encodeURIComponent(v)}` : pathname, { scroll: false }), 250);
  };
  return (
    <label className="relative block w-full md:max-w-[284px]">
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-sand-ink" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <input type="search" value={q} onChange={(e) => change(e.target.value)} placeholder={placeholder} aria-label={label}
        className="w-full rounded-2xl border border-sand-line bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
    </label>
  );
}

/** RU / EN: язык интерфейса админки (cookie через server action), адрес страницы не меняется. Как LangSwitch сайта. */
function AdminLangSwitch() {
  const lang = useAdminLang();
  const other = lang === "en" ? "ru" : "en";
  return (
    <form action={setAdminLang}>
      <input type="hidden" name="lang" value={other} />
      <button lang={other} aria-label={useAdminT().header.langSwitch}
        className="grid h-10 min-w-10 place-items-center rounded-full border border-sand-line bg-white/70 px-3 text-sm font-bold text-sand-ink hover:border-ink hover:text-ink">
        {other.toUpperCase()}
      </button>
    </form>
  );
}

/** Новые заявки приходят без перезагрузки: обновляем данные раз в 20 с и при возвращении на вкладку.
 *  Пока открыта модалка с формой — пропускаем, чтобы не мешать вводу. */
export function useLiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible" && !document.querySelector('[role="dialog"]')) router.refresh();
    };
    const timer = setInterval(tick, 20_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);
}

/** То же без шапки — для мини-аппа Telegram. */
export function LiveRefresh() {
  useLiveRefresh();
  return null;
}

/** Счётчик новых заявок в заголовке вкладки браузера: «(2) Админка» — видно и из другой вкладки. */
function useTitleBadge(count: number) {
  const pathname = usePathname();
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = count > 0 ? `(${count}) ${base}` : base;
  }, [count, pathname]);
}

/** telegram — открыто из мини-аппа Telegram: только брони (поиск и счётчик), без остальных вкладок, настроек и выхода. */
export function AdminHeader({ cars, sights, bookings, newBookings, telegram }: {
  cars: number; sights: number; bookings: number; newBookings: number; telegram?: boolean;
}) {
  const h = useAdminT().header;
  const pathname = usePathname();
  useLiveRefresh();
  useTitleBadge(newBookings);
  const tab = telegram ? "/admin/bookings"
    : pathname.startsWith(SETTINGS) ? SETTINGS : TABS.findLast((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))?.href ?? "/admin";
  const list = tab === "/admin" || tab === "/admin/sights"; // где есть «+ Добавить»
  const searchable = list || tab === "/admin/bookings";
  const count =
    tab === "/admin" ? h.cars(cars)
    : tab === "/admin/sights" ? h.sights(sights)
    : h.bookings(bookings);
  const placeholder =
    tab === "/admin" ? h.searchCars
    : tab === "/admin/sights" ? h.searchSights
    : h.searchBookings;

  return (
    <header className="sticky top-0 z-30 border-b border-sand-line bg-sand/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
        <Link href={telegram ? "/admin/bookings" : "/admin"} className="mr-2 flex items-baseline gap-2 text-xl font-extrabold tracking-tight text-ink">
          <span>Avto<span className="text-brand">Nik</span></span>
        </Link>
        {/* Телефон: 1) логотип + кнопки, 2) поиск на всю ширину, 3) вкладки одной строкой с прокруткой; с md — всё в ряд */}
        {searchable && (
          <div className="flex items-center gap-3 max-md:order-2 max-md:w-full">
            <Suspense fallback={<div className="h-11 w-full rounded-2xl border border-sand-line bg-white md:w-[284px]" />}>
              <SearchBox key={tab} placeholder={placeholder} label={h.search} />
            </Suspense>
            <span className="shrink-0 whitespace-nowrap rounded-full border border-sand-line bg-white/70 px-4 py-2.5 text-xs font-semibold text-sand-ink">{count}</span>
          </div>
        )}
        {!telegram && <nav aria-label={h.nav} className="flex gap-1 rounded-2xl bg-[#ebe3d5] p-1 max-md:order-3 max-md:w-full max-md:overflow-x-auto md:flex-wrap">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} aria-current={t.href === tab ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition ${t.href === tab ? "bg-white text-ink shadow-sm" : "text-sand-ink hover:text-ink"}`}>
              {h.tabs[t.key]}
              {t.href === "/admin/bookings" && newBookings > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-extrabold text-white" aria-label={h.newBookings(newBookings)}>{newBookings}</span>
              )}
            </Link>
          ))}
        </nav>}
        <div className="ml-auto flex items-center gap-1 max-md:order-1">
          {list && (
            <Link href={`${tab}?new=1`} scroll={false} aria-label={h.add}
              className="mr-1 whitespace-nowrap rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-black max-sm:px-4">
              <span className="sm:hidden" aria-hidden="true">+</span><span className="max-sm:hidden">{h.add}</span>
            </Link>
          )}
          <AdminLangSwitch />
          {!telegram && <>
          <a href="/" target="_blank" title={h.openSite} aria-label={h.openSite} className={iconBtn(false)}>
            <svg {...ICON}><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg>
          </a>
          <Link href={SETTINGS} title={h.settings} aria-label={h.settings} aria-current={tab === SETTINGS ? "page" : undefined} className={iconBtn(tab === SETTINGS)}>
            <svg {...ICON}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
          </Link>
          <form action={logout}>
            <button title={h.logout} aria-label={h.logout} className={iconBtn(false)}>
              <svg {...ICON}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>
            </button>
          </form>
          </>}
        </div>
      </div>
    </header>
  );
}
