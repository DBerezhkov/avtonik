"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatPrice, overlapsBusy, rentalPrice, type Busy, type Priced } from "@/lib/format";
import { LOCALE_TAG, path, t, type Lang } from "@/lib/i18n";
import { CarCard, type CarCardData } from "./CarCard";
import { FilterChips } from "./FilterChips";

// categoryOrder — порядок фильтра из админки; busy — подтверждённые брони (занятые даты)
export type CatalogCar = CarCardData & { prices: Priced; categoryOrder: number; busy: Busy[] };

const DAY = 86_400_000;
/** YYYY-MM-DD -> метка времени UTC; NaN для несуществующих дат (Date.parse перекатывает 30.02 в март). */
function parseDate(v: string | null) {
  const t = v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? Date.parse(`${v}T00:00:00Z`) : NaN;
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v ? t : NaN;
}
const fmtDate = (ts: number, lang: Lang) => new Date(ts).toLocaleDateString(LOCALE_TAG[lang], { day: "numeric", month: "short", timeZone: "UTC" });

/** Число суток между датами из поиска (?from=&to=); null — дат нет или они некорректны. */
function rentalDays(from: string | null, to: string | null) {
  const a = parseDate(from), b = parseDate(to);
  const days = Math.round((b - a) / DAY);
  return Number.isNaN(a) || Number.isNaN(b) || days < 1 || days > 365 ? null : { from: a, to: b, days, query: `from=${from}&to=${to}`, ymd: [from!, to!] as const };
}

function totalFor(c: CatalogCar, days: number, currency: string, lang: Lang) {
  return { price: formatPrice(rentalPrice(c.prices, days).total, currency, lang), days };
}

type ViewProps = {
  cars: CatalogCar[]; currency: string; lang: Lang; cat: string | null; period: ReturnType<typeof rentalDays>;
  onCat?: (v: string | null) => void;
  free?: boolean; onFree?: (v: boolean) => void; // «Свободные»: только машины без брони на выбранные даты (без дат — на сегодня)
};

/** Сам каталог: фильтр по классу + сетка. Все машины всегда в HTML (для поисковиков), фильтр только скрывает лишние. */
export function CarCatalogView({ cars, currency, lang, cat, period, onCat, free = false, onFree }: ViewProps) {
  const d = t(lang);
  const counts = new Map<string, [string, number, number]>();
  for (const c of cars) counts.set(c.category, [c.categoryLabel, (counts.get(c.category)?.[1] ?? 0) + 1, c.categoryOrder]);
  const active = cat && counts.has(cat) ? cat : null;
  // Занятые на выбранные даты — приглушены и в конце списка (sort стабильный — порядок остальных сохраняется)
  const busy = (c: CatalogCar) => !!period && overlapsBusy(c.busy, ...period.ymd);
  // «Свободные»: на выбранные даты, а без дат — на сегодня (считается только по клику — без расхождения с HTML сервера)
  const today = () => { const n = new Date(); return new Date(n.getTime() - n.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); };
  const isFree = (c: CatalogCar) => (period ? !busy(c) : !c.busy.some((b) => b.from <= today() && today() < b.to));
  const visible = cars.filter((c) => (active === null || c.category === active) && (!free || isFree(c)));
  const ordered = period ? [...cars].sort((x, y) => Number(busy(x)) - Number(busy(y))) : cars;

  return (
    <>
      {period && (
        <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-brand/10 px-5 py-3 text-sm">
          <span>
            {d.catalog.period}: <strong>{fmtDate(period.from, lang)} — {fmtDate(period.to, lang)}</strong> · {d.days(period.days)}. {d.catalog.pricesForPeriod}
          </span>
          <Link href={path(lang, active ? `/cars?type=${active}` : "/cars")} className="font-bold text-brand hover:text-brand-dark">{d.catalog.resetDates}</Link>
        </p>
      )}
      <FilterChips options={[...counts].sort((a, b) => a[1][2] - b[1][2]).map(([k, [l, n]]) => [k, l, n])} value={active} onChange={onCat ?? (() => {})} lang={lang}
        before={
          <button type="button" aria-pressed={free} onClick={() => onFree?.(!free)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${free ? "bg-green-700 text-white" : "bg-surface text-slate-700 ring-1 ring-slate-200 hover:ring-green-700"}`}>
            <span className={`grid size-4 place-items-center rounded-full text-[10px] ${free ? "bg-white text-green-700" : "ring-1 ring-slate-400"}`} aria-hidden="true">{free && "✓"}</span>
            {d.catalog.free}{free && <span className="opacity-70"> {cars.filter(isFree).length}</span>}
          </button>
        } />
      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((c) => (
          <li key={c.id} hidden={!visible.includes(c)}>
            <CarCard car={c} lang={lang} priority={visible.indexOf(c) >= 0 && visible.indexOf(c) < 3} busy={busy(c)}
              total={period && !busy(c) ? totalFor(c, period.days, currency, lang) : undefined} dates={period?.query} />
          </li>
        ))}
      </ul>
    </>
  );
}

/** Каталог с фильтром из адреса: ?type=<класс>&from=YYYY-MM-DD&to=YYYY-MM-DD (так приходит поиск с главной). */
export function CarCatalog({ cars, currency, lang }: { cars: CatalogCar[]; currency: string; lang: Lang }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = path(lang, "/cars"); // не usePathname: при rewrite он может вернуть внутренний /en/cars

  const setCat = (v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set("type", v);
    else next.delete("type");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const [free, setFree] = useState(false);
  return <CarCatalogView cars={cars} currency={currency} lang={lang} cat={params.get("type")} period={rentalDays(params.get("from"), params.get("to"))}
    onCat={setCat} free={free} onFree={setFree} />;
}
