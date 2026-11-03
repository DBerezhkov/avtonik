import Link from "next/link";
import { path, t, type Lang } from "@/lib/i18n";

/** Оболочка правовых страниц: крошки, заголовок, текст. */
export function LegalPage({ title, updated, lang, children }: { title: string; updated?: string; lang: Lang; children: React.ReactNode }) {
  const home = path(lang, "/");
  const homeLabel = t(lang).breadcrumbs.home;
  return (
    <article className="mx-auto max-w-3xl px-4 pt-10">
      <nav aria-label={t(lang).breadcrumbs.aria} className="text-sm text-slate-500">
        <Link href={home} className="hover:text-brand">{homeLabel}</Link> / <span>{title}</span>
      </nav>
      <h1 className="mt-4 text-3xl font-extrabold md:text-4xl">{title}</h1>
      {updated && <p className="mt-2 text-sm text-slate-500">{updated}</p>}
      <div className="mt-8 space-y-8 leading-7 text-slate-700 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-fg [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
        {children}
      </div>
    </article>
  );
}
