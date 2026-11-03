"use client";

import { useState } from "react";
import type { Lang } from "@/lib/i18n";
import { FilterChips } from "./FilterChips";
import { SightCard, type SightCardData } from "./SightCard";

/** Сетка мест с фильтром по направлениям; order — ключи фильтров в порядке из админки. */
export function SightGrid({ sights, lang, order }: { sights: SightCardData[]; lang: Lang; order: string[] }) {
  const [cat, setCat] = useState<string | null>(null);
  const counts = new Map<string, [string, number]>();
  for (const s of sights) if (s.category) counts.set(s.category, [s.categoryLabel, (counts.get(s.category)?.[1] ?? 0) + 1]);
  const chips = [...counts].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map(([k, [l, n]]) => [k, l, n] as [string, string, number]);

  return (
    <>
      <FilterChips options={chips} value={cat} onChange={setCat} lang={lang} />
      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sights.map((s) => (
          <li key={s.id} hidden={cat !== null && s.category !== cat}>
            <SightCard sight={s} lang={lang} />
          </li>
        ))}
      </ul>
    </>
  );
}
