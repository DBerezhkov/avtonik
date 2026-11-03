import Link from "next/link";
import { path, t, type Lang } from "@/lib/i18n";
import { Photo } from "./Photo";

export type CarCardData = {
  id: number;
  slug: string;
  name: string;
  category: string;
  categoryLabel: string;
  specs: string;
  price: string;
  image: string | null;
  alt: string;
};

/** Карточка машины: на главной и в каталоге. total — цена за выбранные даты и число суток, за которое она посчитана (если даты заданы);
 *  dates — те же даты в виде from=…&to=…, чтобы страница машины открылась с ними. */
export function CarCard({ car, lang, priority, total, dates, busy }: {
  car: CarCardData; lang: Lang; priority?: boolean; total?: { price: string; days: number }; dates?: string;
  busy?: boolean; // занята на выбранные даты: приглушена, без цены за срок, ссылка — без дат (выбрать другие)
}) {
  const d = t(lang).card;
  return (
    <Link
      href={path(lang, `/cars/${car.slug}`) + (dates && !busy ? `?${dates}` : "")}
      className={`group flex h-full flex-col overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-xl ${busy ? "opacity-60 grayscale" : ""}`}
    >
      <div className="relative aspect-[3/2] bg-slate-200">
        {car.image && (
          <Photo src={car.image} alt={car.alt} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-105" priority={priority} />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-surface/95 px-3 py-1 text-xs font-bold text-fg shadow">{car.categoryLabel}</span>
        {busy && (
          <span className="absolute right-3 top-3 rounded-full bg-ink/90 px-3 py-1 text-xs font-bold text-white shadow">{d.busy}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold group-hover:text-brand">{car.name}</h3>
        <p className="mt-1 text-sm text-slate-600">{car.specs}</p>
        <div className="mt-4 flex flex-1 items-end justify-between gap-3">
          <p className="text-sm text-slate-500">
            {busy ? (
              <span className="font-bold text-fg">{d.busy}</span>
            ) : total ? (
              <><span className="text-2xl font-extrabold text-fg">{total.price}</span> {d.total(total.days)}</>
            ) : (
              <>{d.from} <span className="text-2xl font-extrabold text-fg">{car.price}</span> {d.perDay}</>
            )}
          </p>
          <span className="shrink-0 text-sm font-bold text-brand group-hover:text-brand-dark">{d.more}</span>
        </div>
      </div>
    </Link>
  );
}
