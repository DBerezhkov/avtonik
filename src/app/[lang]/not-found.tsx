import Link from "next/link";
import { lang as rootLang } from "next/root-params";
import { DEFAULT_LANG, isLang, path, t } from "@/lib/i18n";

export default async function NotFound() {
  const raw = await rootLang();
  const lang = raw && isLang(raw) ? raw : DEFAULT_LANG;
  const d = t(lang).notFound;
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">{d.title}</h1>
      <p className="mt-3 text-slate-600">{d.text}</p>
      <Link href={path(lang, "/")} className="mt-6 inline-block rounded-full bg-brand px-6 py-3 font-semibold text-white">{d.home}</Link>
    </div>
  );
}
