import { DeliveryForm } from "@/components/admin/DeliveryForm";
import { Saved } from "@/components/admin/Saved";
import { adminT } from "@/lib/admin-i18n";
import { getAdminLang } from "@/lib/admin-lang";
import { readSettings } from "@/lib/data";
import { formatPrice, parsePickupPoints } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

// Админка рендерится на каждый запрос за сессией; задаётся на странице, т.к. ответ server action учитывает конфиг страницы.
export const instant = false;

export default async function DeliveryPage({ searchParams }: PageProps<"/admin/delivery">) {
  await requireAdmin();
  const { saved } = await searchParams;
  const s = readSettings();
  const lang = await getAdminLang();
  const t = adminT(lang).delivery;
  const points = parsePickupPoints(s.pickup_points);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <Saved show={!!saved} />
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-sand-line md:p-8">
        <h1 className="text-2xl font-extrabold">{t.title}</h1>
        <p className="mb-6 mt-1 text-sm text-sand-ink">{t.lead}</p>
        <DeliveryForm points={points} currency={s.currency} />
      </div>
      <aside className="h-fit rounded-3xl bg-white p-6 shadow-sm ring-1 ring-sand-line">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-sand-ink">{t.preview}</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {points.map((p) => (
            <li key={p.name} className="flex items-start justify-between gap-3 border-b border-sand-line pb-2 last:border-0">
              <span>{lang === "en" ? p.name_en || p.name : p.name}</span>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${p.price > 0 ? "bg-brand/10 text-brand" : "bg-green-100 text-green-700"}`}>
                {p.price > 0 ? formatPrice(p.price, s.currency, lang) : t.free}
              </span>
            </li>
          ))}
          {points.length === 0 && <li className="text-sand-ink">{t.empty}</li>}
        </ul>
      </aside>
    </div>
  );
}
