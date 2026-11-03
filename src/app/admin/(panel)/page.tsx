import { deleteCar } from "../actions";
import { AdminCard } from "@/components/admin/AdminCard";
import { CarForm } from "@/components/admin/CarForm";
import { FilterPanel } from "@/components/admin/Filters";
import { Saved } from "@/components/admin/Saved";
import { Modal } from "@/components/admin/ui";
import { adminT } from "@/lib/admin-i18n";
import { getAdminLang } from "@/lib/admin-lang";
import { categoryName, readCars, readCategories, readSettings } from "@/lib/data";
import { carName, formatPrice, imageUrl } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

// Админка рендерится на каждый запрос за сессией; задаётся на странице, т.к. ответ server action учитывает конфиг страницы.
export const instant = false;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AdminCarsPage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const sp = await searchParams;
  const lang = await getAdminLang();
  const t = adminT(lang);
  const q = one(sp.q).trim().toLowerCase();
  const all = readCars(false);
  const { currency } = readSettings();
  const cats = readCategories("car");
  const cars = q
    ? all.filter((c) => `${carName(c)} ${categoryName(cats, c.category, "ru")} ${categoryName(cats, c.category, "en")} ${c.body_type}`.toLowerCase().includes(q))
    : all;
  const base = q ? `/admin?q=${encodeURIComponent(q)}` : "/admin";
  const withParam = (k: string, v: string | number) => `${base}${base.includes("?") ? "&" : "?"}${k}=${v}`;
  const editing = one(sp.edit) ? all.find((c) => c.id === Number(one(sp.edit))) : undefined;

  return (
    <>
      <Saved show={!!one(sp.saved)} key={one(sp.saved)} />
      <FilterPanel kind="car" rows={cats.map((c) => ({ ...c, count: all.filter((x) => x.category === c.key).length }))}
        open={!!one(sp.filters)} error={one(sp.ferror) || undefined} />
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cars.map((c) => (
          <AdminCard
            key={c.id}
            lang={lang}
            image={imageUrl(c.images[0]?.file)}
            published={!!c.is_published}
            title={`${c.brand} ${c.model}`}
            subtitle={`${categoryName(cats, c.category, lang)} · ${c.year}`}
            price={formatPrice(c.price_per_day, currency)}
            editHref={withParam("edit", c.id)}
            onDelete={deleteCar.bind(null, c.id)}
            deleteMessage={t.cars.confirmDelete(carName(c))}
          />
        ))}
      </ul>
      {cars.length === 0 && <p className="py-16 text-center text-sand-ink">{q ? t.notFound : t.cars.empty}</p>}

      {one(sp.new) && (
        <Modal title={t.cars.new} closeHref={base}>
          <CarForm currency={currency} categories={cats} closeHref={base} />
        </Modal>
      )}
      {editing && (
        <Modal title={t.editing(`${editing.brand} ${editing.model}`)} closeHref={base}>
          <CarForm car={editing} currency={currency} categories={cats} closeHref={base} key={editing.id} />
        </Modal>
      )}
    </>
  );
}
