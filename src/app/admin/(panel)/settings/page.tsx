import { Saved } from "@/components/admin/Saved";
import { ReviewsSync, SettingsForm } from "@/components/admin/SettingsForm";
import { Photo } from "@/components/Photo";
import { adminT } from "@/lib/admin-i18n";
import { getAdminLang } from "@/lib/admin-lang";
import { parseSocials, readSettings } from "@/lib/data";
import { imageUrl } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

// Админка рендерится на каждый запрос за сессией; задаётся на странице, т.к. ответ server action учитывает конфиг страницы.
export const instant = false;

export default async function SettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  await requireAdmin();
  const s = readSettings();
  const t = adminT(await getAdminLang()).settings;
  return (
    <>
      <Saved show={!!(await searchParams).saved} />
      <h1 className="mb-6 text-2xl font-extrabold">{t.title}</h1>
      <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-sand-line md:p-8">
        <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-sand-ink">{t.reviews}</h2>
        <ReviewsSync s={s} />
      </section>
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-sand-line md:p-8">
        <div className="mb-6 flex flex-wrap gap-6">
          {s.logo && (
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element -- логотип любых пропорций */}
              <img src={imageUrl(s.logo)!} alt="" className="h-28 w-auto max-w-48 rounded-lg bg-sand object-contain p-3" />
              <figcaption className="mt-1 text-xs text-sand-ink">{t.logo}</figcaption>
            </figure>
          )}
          {s.hero_image && (
            <figure>
              <div className="relative h-28 w-48 overflow-hidden rounded-lg bg-sand">
                <Photo src={imageUrl(s.hero_image)!} alt="" fill sizes="192px" className="object-cover" />
              </div>
              <figcaption className="mt-1 text-xs text-sand-ink">{t.heroCaption}</figcaption>
            </figure>
          )}
        </div>
        <SettingsForm s={s} socials={parseSocials(s.socials)} />
      </div>
    </>
  );
}
