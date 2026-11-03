"use client";

import Link from "next/link";
import { useActionState } from "react";
import { deleteCar, deleteCarImage, reorderCarImages, saveCar } from "@/app/admin/actions";
import type { Car, Category } from "@/lib/data";
import { FUELS, TRANSMISSIONS } from "@/lib/format";
import { useAdminT } from "./AdminLang";
import { Photos } from "./Photos";
import { Area, Field, FormError, ModalBody, ModalFooter, Section, Select, SubmitButton, Toggle, btnDanger, btnOutline, categoryOptions } from "./ui";

/** Форма машины внутри модалки: тело с разделами + футер «Удалить / Отмена / Сохранить». */
export function CarForm({ car, currency, categories, closeHref }: { car?: Car; currency: string; categories: Category[]; closeHref: string }) {
  const [state, action] = useActionState(saveCar.bind(null, car?.id ?? null), undefined);
  // После ошибки React сбрасывает форму — подставляем введённые значения из ответа action.
  const v = (k: string, fallback?: string | number | null) => (state?.values ? (state.values[k] ?? "") : (fallback ?? ""));
  const t = useAdminT();
  const c = t.cars;
  const published = state?.values ? "is_published" in state.values : car ? !!car.is_published : true;

  return (
    <form action={action} className="flex min-h-0 flex-1 flex-col">
      {/* Enter в поле отправляет форму первой submit-кнопкой — это должно быть «Сохранить», а не «Удалить» */}
      <button type="submit" className="sr-only" aria-hidden="true" tabIndex={-1} />
      <ModalBody>
        <FormError error={state?.error} />
        <Section title={c.photos}>
          <Photos ownerId={car?.id} images={car?.images ?? []} resync={state} onDelete={deleteCarImage} onReorder={reorderCarImages} />
        </Section>

        <Section title={c.main}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={c.name} name="name" defaultValue={v("name", car && `${car.brand} ${car.model}`)} required placeholder="Toyota Prius" />
            <Field label={c.year} name="year" type="number" defaultValue={v("year", car?.year)} required min={1980} max={2100} />
            <Select label={c.category} name="category" options={categoryOptions(categories)} defaultValue={v("category", car?.category ?? categories[0]?.key)} />
            <Select label={c.transmission} name="transmission" options={TRANSMISSIONS} defaultValue={v("transmission", car?.transmission ?? "automatic")} />
            <Select label={c.fuel} name="fuel" options={FUELS} defaultValue={v("fuel", car?.fuel ?? "petrol")} />
            <Field label={c.seats} name="seats" type="number" min={1} defaultValue={v("seats", car?.seats ?? 5)} />
            <Field label={c.luggage} name="luggage" type="number" min={0} defaultValue={v("luggage", car?.luggage ?? 2)} />
            <Toggle label={t.status} on={c.on} off={c.off} name="is_published" defaultChecked={published} key={String(published)} />
          </div>
        </Section>

        <Section title={c.price}>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label={c.pricePerDay(currency)} name="price_per_day" type="number" min={1} defaultValue={v("price_per_day", car?.price_per_day)} required className="sm:col-span-4" />
            <Field label={c.tiers[0]} name="price_1_3" type="number" min={1} defaultValue={v("price_1_3", car?.price_1_3)} />
            <Field label={c.tiers[1]} name="price_4_7" type="number" min={1} defaultValue={v("price_4_7", car?.price_4_7)} />
            <Field label={c.tiers[2]} name="price_8_30" type="number" min={1} defaultValue={v("price_8_30", car?.price_8_30)} />
            <Field label={c.tiers[3]} name="price_30_plus" type="number" min={1} defaultValue={v("price_30_plus", car?.price_30_plus)} />
          </div>
          <p className="mt-2 text-xs text-sand-ink">{c.tiersHint}</p>
        </Section>

        <Section title={c.description}>
          <Area label={c.description} name="description" defaultValue={v("description", car?.description)} />
        </Section>

        {car && !!car.is_published && (
          <a href={`/cars/${car.slug}`} target="_blank" className="inline-block text-sm font-semibold text-brand hover:underline">{c.sitePage}</a>
        )}
      </ModalBody>

      <ModalFooter>
        {car && (
          <button type="submit" formAction={deleteCar.bind(null, car.id)} formNoValidate className={btnDanger}
            onClick={(e) => { if (!confirm(c.confirmDelete(`${car.brand} ${car.model}`))) e.preventDefault(); }}>
            {c.deleteCar}
          </button>
        )}
        <span className="ml-auto" />
        <Link href={closeHref} scroll={false} data-close className={btnOutline}>{t.cancel}</Link>
        <SubmitButton>{car ? t.save : c.addCar}</SubmitButton>
      </ModalFooter>
    </form>
  );
}
