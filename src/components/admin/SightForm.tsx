"use client";

import Link from "next/link";
import { useActionState } from "react";
import { deleteSight, deleteSightImage, reorderSightImages, saveSight } from "@/app/admin/actions";
import type { Category, Sight } from "@/lib/data";
import { SIGHT_CARS } from "@/lib/format";
import { useAdminT } from "./AdminLang";
import { Photos } from "./Photos";
import { Area, Field, FormError, ModalBody, ModalFooter, Section, Select, SubmitButton, Toggle, btnDanger, btnOutline, categoryOptions } from "./ui";


/** Форма места внутри модалки: тело с разделами + футер «Удалить / Отмена / Сохранить». */
export function SightForm({ sight, categories, closeHref }: { sight?: Sight; categories: Category[]; closeHref: string }) {
  const [state, action] = useActionState(saveSight.bind(null, sight?.id ?? null), undefined);
  // После ошибки React сбрасывает форму — подставляем введённые значения из ответа action.
  const v = (k: string, fallback?: string | number | null) => (state?.values ? (state.values[k] ?? "") : (fallback ?? ""));
  const t = useAdminT();
  const x = t.sights;
  const published = state?.values ? "is_published" in state.values : sight ? !!sight.is_published : true;

  return (
    <form action={action} className="flex min-h-0 flex-1 flex-col">
      {/* Enter в поле отправляет форму первой submit-кнопкой — это должно быть «Сохранить», а не «Удалить» */}
      <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1} />
      <ModalBody>
        <FormError error={state?.error} />
        <Section title={x.photo}>
          <Photos ownerId={sight?.id} images={sight?.images ?? []} resync={state} onDelete={deleteSightImage} onReorder={reorderSightImages} />
        </Section>

        <Section title={x.main}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={x.name} name="name" defaultValue={v("name", sight?.name)} required placeholder="Монастырь Джвари" />
            <Field label={x.region} name="region" defaultValue={v("region", sight?.region)} placeholder="Мцхета" />
            <Select label={x.route} name="category" options={categoryOptions(categories)} defaultValue={v("category", sight?.category ?? categories[0]?.key)} />
            <Select label={x.carType} name="car_type" options={SIGHT_CARS} defaultValue={v("car_type", sight?.car_type ?? "any")} />
            <Toggle label={t.status} on={x.on} off={x.off} name="is_published" defaultChecked={published} key={String(published)} />
          </div>
        </Section>

        <Section title={x.description}>
          <Area label={x.description} name="description" defaultValue={v("description", sight?.description)} rows={3} />
        </Section>

        <Section title={x.english}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name (EN)" name="name_en" defaultValue={v("name_en", sight?.name_en)} placeholder="Jvari Monastery" />
            <Field label="Region (EN)" name="region_en" defaultValue={v("region_en", sight?.region_en)} placeholder="Mtskheta" />
            <Area label="Description (EN)" name="description_en" defaultValue={v("description_en", sight?.description_en)} rows={3} className="sm:col-span-2"
              hint={x.englishHint} />
          </div>
        </Section>

        <Section title={x.map}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={x.mapsUrl} name="maps_url" type="url" defaultValue={v("maps_url", sight?.maps_url)} placeholder="https://maps.app.goo.gl/…"
              className="sm:col-span-2" hint={x.mapsHint} />
            <Field label={x.lat} name="lat" inputMode="decimal" defaultValue={v("lat", sight?.lat ?? "")} placeholder="41.8382" />
            <Field label={x.lng} name="lng" inputMode="decimal" defaultValue={v("lng", sight?.lng ?? "")} placeholder="44.7336" />
          </div>
          <p className="mt-2 text-xs text-sand-ink">{x.coordsHint}</p>
        </Section>

        <Section title={x.road}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={x.distance} name="distance_km" type="number" min={0} defaultValue={v("distance_km", sight?.distance_km ?? "")} />
            <Field label={x.driveMin} name="drive_min" type="number" min={0} defaultValue={v("drive_min", sight?.drive_min ?? "")} />
          </div>
          <p className="mt-2 text-xs text-sand-ink">{x.roadHint}</p>
        </Section>

        <Section title={x.extra}>
          <div className="w-32">
            <Field label={x.order} name="sort_order" type="number" defaultValue={v("sort_order", sight?.sort_order ?? 0)} />
          </div>
        </Section>
      </ModalBody>

      <ModalFooter>
        {sight && (
          <button type="submit" formAction={deleteSight.bind(null, sight.id)} formNoValidate className={btnDanger}
            onClick={(e) => { if (!confirm(x.confirmDelete(sight.name))) e.preventDefault(); }}>
            {x.deleteSight}
          </button>
        )}
        <span className="ml-auto" />
        <Link href={closeHref} scroll={false} data-close className={btnOutline}>{t.cancel}</Link>
        <SubmitButton>{sight ? t.save : x.addSight}</SubmitButton>
      </ModalFooter>
    </form>
  );
}
