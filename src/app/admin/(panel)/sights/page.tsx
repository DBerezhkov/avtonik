import { deleteSight } from "../../actions";
import { AdminCard } from "@/components/admin/AdminCard";
import { FilterPanel } from "@/components/admin/Filters";
import { Saved } from "@/components/admin/Saved";
import { SightForm } from "@/components/admin/SightForm";
import { Modal } from "@/components/admin/ui";
import { adminT } from "@/lib/admin-i18n";
import { getAdminLang } from "@/lib/admin-lang";
import { categoryName, readCategories, readSights } from "@/lib/data";
import { imageUrl } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

// Админка рендерится на каждый запрос за сессией; задаётся на странице, т.к. ответ server action учитывает конфиг страницы.
export const instant = false;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AdminSightsPage({ searchParams }: PageProps<"/admin/sights">) {
  await requireAdmin();
  const sp = await searchParams;
  const lang = await getAdminLang();
  const t = adminT(lang);
  const q = one(sp.q).trim().toLowerCase();
  const all = readSights(false);
  const cats = readCategories("sight");
  const sights = q
    ? all.filter((x) => `${x.name} ${x.region} ${categoryName(cats, x.category, "ru")} ${categoryName(cats, x.category, "en")} ${x.name_en}`.toLowerCase().includes(q))
    : all;
  const base = q ? `/admin/sights?q=${encodeURIComponent(q)}` : "/admin/sights";
  const withParam = (k: string, v: string | number) => `${base}${base.includes("?") ? "&" : "?"}${k}=${v}`;
  const editing = one(sp.edit) ? all.find((x) => x.id === Number(one(sp.edit))) : undefined;

  return (
    <>
      <Saved show={!!one(sp.saved)} key={one(sp.saved)} />
      <FilterPanel kind="sight" rows={cats.map((c) => ({ ...c, count: all.filter((x) => x.category === c.key).length }))}
        open={!!one(sp.filters)} error={one(sp.ferror) || undefined} />
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sights.map((x) => (
          <AdminCard
            key={x.id}
            lang={lang}
            image={imageUrl(x.image)}
            published={!!x.is_published}
            badgeWhenPublished={false}
            title={x.name}
            subtitle={[x.region, categoryName(cats, x.category, lang)].filter(Boolean).join(" · ")}
            editHref={withParam("edit", x.id)}
            onDelete={deleteSight.bind(null, x.id)}
            deleteMessage={t.sights.confirmDelete(x.name)}
          />
        ))}
      </ul>
      {sights.length === 0 && <p className="py-16 text-center text-sand-ink">{q ? t.notFound : t.sights.empty}</p>}

      {one(sp.new) && (
        <Modal title={t.sights.new} closeHref={base}>
          <SightForm categories={cats} closeHref={base} />
        </Modal>
      )}
      {editing && (
        <Modal title={t.editing(editing.name)} closeHref={base}>
          <SightForm sight={editing} categories={cats} closeHref={base} key={editing.id} />
        </Modal>
      )}
    </>
  );
}
