import Link from "next/link";
import { path, t, type Lang } from "@/lib/i18n";
import { Photo } from "./Photo";

export type SightCardData = {
  id: number;
  name: string;
  region: string;
  category: string; // ключ фильтра
  categoryLabel: string; // его название на языке страницы
  description: string;
  image: string | null;
  distanceKm: number | null; // от центра Батуми — плашка на фото слева
  carType: string; // какая машина нужна («Полный привод 4×4») — плашка на фото справа
  slug: string;
  mapsHref: string;
};

/** Карточка места: на главной и на странице «Куда поехать». Ведёт на страницу места, отдельная ссылка — в Google Maps. */
export function SightCard({ sight: s, lang }: { sight: SightCardData; lang: Lang }) {
  const d = t(lang).sights;
  const href = path(lang, `/sights/${s.slug}`);
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-surface shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-xl">
      <Link href={href} className="relative block aspect-[4/3] overflow-hidden bg-gradient-to-br from-teal-700 to-sky-900">
        {s.image ? (
          <Photo src={s.image} alt={`${s.name}${s.region ? `, ${s.region}` : ""}`} fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <span className="absolute inset-0 grid place-items-center p-6 text-center text-xl font-bold text-white/90">{s.name}</span>
        )}
        {s.distanceKm != null && (
          <span className="absolute left-3 top-3 rounded-full bg-surface/95 px-3 py-1 text-xs font-bold text-fg shadow">{t(lang).sight.fromBatumi(s.distanceKm)}</span>
        )}
        {s.carType && (
          <span className="absolute right-3 top-3 max-w-[55%] truncate rounded-full bg-ink/90 px-3 py-1 text-xs font-bold text-white shadow">{s.carType}</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold">
          <Link href={href} className="hover:text-brand">{s.name}</Link>
        </h3>
        {s.region && <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.region}</p>}
        <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{s.description}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm font-bold">
          {s.categoryLabel && <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand">{s.categoryLabel}</span>}
          <a href={s.mapsHref} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-brand">{d.maps}</a>
        </div>
      </div>
    </article>
  );
}
