import type { MetadataRoute } from "next";
import { getCars, getSights } from "@/lib/data";
import { absoluteUrl } from "@/lib/format";
import { LOCALES, languages, path } from "@/lib/i18n";

type Entry = MetadataRoute.Sitemap[number];

/** Каждая страница — на всех языках, с hreflang-ссылками друг на друга. */
function page(p: string, extra: Omit<Entry, "url" | "alternates">): Entry[] {
  const alt = Object.fromEntries(Object.entries(languages(p)).map(([k, v]) => [k, absoluteUrl(v)]));
  return LOCALES.map((lang) => ({ url: absoluteUrl(path(lang, p)), alternates: { languages: alt }, ...extra }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [cars, sights] = await Promise.all([getCars(), getSights()]);
  return [
    ...page("/", { changeFrequency: "weekly", priority: 1 }),
    ...page("/cars", { changeFrequency: "weekly", priority: 0.9 }),
    ...page("/sights", { changeFrequency: "monthly", priority: 0.7 }),
    ...page("/privacy", { changeFrequency: "yearly", priority: 0.2 }),
    ...page("/terms", { changeFrequency: "yearly", priority: 0.3 }),
    ...cars.flatMap((c) =>
      page(`/cars/${c.slug}`, {
        lastModified: new Date(c.updated_at.replace(" ", "T") + "Z"),
        changeFrequency: "weekly",
        priority: 0.8,
      }),
    ),
    ...sights.flatMap((x) =>
      page(`/sights/${x.slug}`, {
        lastModified: new Date(x.updated_at.replace(" ", "T") + "Z"),
        changeFrequency: "monthly",
        priority: 0.6,
      }),
    ),
  ];
}
