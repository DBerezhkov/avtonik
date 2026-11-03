"use client";

import { useActionState, useState } from "react";
import { saveSettings, syncReviews } from "@/app/admin/actions";
import type { Settings, Social } from "@/lib/data";
import { LOCALE_TAG } from "@/lib/i18n";
import { useAdminLang, useAdminT } from "./AdminLang";
import { Field, FormError, SubmitButton } from "./ui";

/** Соцсети: строки «название + ссылка», можно добавлять и убирать. Состояние в React — не теряется при ошибке сохранения. */
function SocialsEditor({ initial }: { initial: Social[] }) {
  const x = useAdminT().settings;
  const [rows, setRows] = useState(initial.length ? initial : [{ name: "", url: "" }]);
  const edit = (i: number, k: keyof Social, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="space-y-3 sm:col-span-2">
      {rows.map((r, i) => (
        <div key={i} className="grid items-end gap-3 sm:grid-cols-[12rem_1fr_auto]">
          <Field label={x.socialName} name="social_name" value={r.name} onChange={(e) => edit(i, "name", e.target.value)} placeholder="Instagram" />
          <Field label={x.socialUrl} name="social_url" type="url" value={r.url} onChange={(e) => edit(i, "url", e.target.value)} placeholder="https://" />
          <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))}
            className="rounded-xl border border-sand-line bg-white px-4 py-3 text-sm font-semibold hover:border-ink">{x.socialRemove}</button>
        </div>
      ))}
      <button type="button" onClick={() => setRows([...rows, { name: "", url: "" }])}
        className="rounded-xl border border-dashed border-sand-line px-4 py-2.5 text-sm font-semibold hover:border-ink">{x.socialAdd}</button>
    </div>
  );
}

/** Цвет темы: палитра + код #rrggbb (одно значение, поле brand_color). */
function BrandColor({ initial }: { initial: string }) {
  const x = useAdminT().settings;
  const [color, setColor] = useState(initial || "#ea580c");
  return (
    <div>
      <span className="block text-[11px] font-bold uppercase tracking-wider text-sand-ink">{x.brandColor}</span>
      <div className="mt-1.5 flex items-center gap-3">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label={x.brandColor}
          className="h-12 w-16 cursor-pointer rounded-xl border border-sand-line bg-sand-field p-1" />
        <input name="brand_color" value={color} onChange={(e) => setColor(e.target.value)} pattern="#[0-9a-fA-F]{6}" maxLength={7}
          className="w-28 rounded-xl border border-sand-line bg-sand-field px-3 py-3 font-mono text-sm uppercase outline-none focus:border-brand" />
        {color.toLowerCase() !== "#ea580c" && (
          <button type="button" onClick={() => setColor("#ea580c")} className="text-sm font-semibold text-sand-ink underline hover:text-ink">{x.brandReset}</button>
        )}
      </div>
      <span className="mt-1 block text-xs text-sand-ink">{x.brandColorHint}</span>
    </div>
  );
}

export function SettingsForm({ s, socials }: { s: Settings; socials: Social[] }) {
  const [state, action] = useActionState(saveSettings, undefined);
  const t = useAdminT();
  const x = t.settings;
  // После ошибки React сбрасывает форму — подставляем введённые значения из ответа action.
  const v = (k: keyof Settings) => (state?.values ? (state.values[k] ?? "") : s[k]);
  return (
    <form action={action} className="space-y-8">
      <FormError error={state?.error} />
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-xs font-extrabold uppercase tracking-wider text-sand-ink">{x.site}</legend>
        <Field label={x.siteName} name="site_name" defaultValue={v("site_name")} required />
        <BrandColor initial={s.brand_color} />
        <div>
          <Field label={x.logo} name="logo" type="file" accept="image/png,image/webp,image/jpeg" hint={x.logoHint} />
          {s.logo && (
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" name="logo_remove" className="size-4 accent-brand" /> {x.logoRemove}
            </label>
          )}
        </div>
        <Field label={x.heroImage} name="hero_image" type="file" accept="image/jpeg,image/png,image/webp" hint={x.heroImageHint} />
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-xs font-extrabold uppercase tracking-wider text-sand-ink">{x.contacts}</legend>
        <Field label={x.phone} name="phone" defaultValue={v("phone")} required />
        <Field label={x.whatsapp} name="whatsapp" defaultValue={v("whatsapp")} hint={x.whatsappHint} />
        <Field label="Telegram" name="telegram" defaultValue={v("telegram")} placeholder="@username" />
        <Field label="Email" name="email" type="email" defaultValue={v("email")} />
        <Field label={x.address} name="address" defaultValue={v("address")} className="sm:col-span-2" />
        <Field label={x.addressEn} name="address_en" defaultValue={v("address_en")} className="sm:col-span-2" />
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-xs font-extrabold uppercase tracking-wider text-sand-ink">{x.socials}</legend>
        <SocialsEditor initial={socials} />
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-xs font-extrabold uppercase tracking-wider text-sand-ink">{x.google}</legend>
        <Field label={x.reviewUrl} name="google_review_url" type="url" defaultValue={v("google_review_url")}
          placeholder="https://g.page/r/…/review" hint={x.reviewUrlHint} />
        <Field label="Google Place ID" name="google_place_id" defaultValue={v("google_place_id")}
          hint={x.placeIdHint} />
      </fieldset>
      <SubmitButton>{t.save}</SubmitButton>
    </form>
  );
}

export function ReviewsSync({ s }: { s: Settings }) {
  const [state, action, pending] = useActionState(syncReviews, undefined);
  const x = useAdminT().settings;
  const lang = useAdminLang();
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-sand-ink">
        {s.google_rating
          ? <>{x.rating} <b>{s.google_rating}</b>, {x.ratingCount} <b>{s.google_rating_count}</b>.</>
          : x.noReviews}
        {s.reviews_synced_at && x.updated(new Date(s.reviews_synced_at).toLocaleString(LOCALE_TAG[lang]))}
      </p>
      <FormError error={state?.error} />
      {state?.ok && <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">{state.ok}</p>}
      <button type="submit" disabled={pending} className="rounded-xl border border-sand-line bg-white px-4 py-2.5 text-sm font-semibold hover:border-ink disabled:opacity-60">
        {pending ? x.syncing : x.sync}
      </button>
    </form>
  );
}
