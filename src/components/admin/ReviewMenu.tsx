"use client";

import { useEffect, useRef } from "react";
import { saveBookingReview } from "@/app/admin/actions";
import type { ClientReview } from "@/lib/data";
import { useAdminT } from "./AdminLang";

/** «⋯» справа на карточке брони: отзыв админа о клиенте — оценка и комментарий. Закрывается после сохранения, по Esc и клику мимо. */
export function ReviewMenu({ id, review, note }: { id: number; review: ClientReview; note: string }) {
  const t = useAdminT().bookings;
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      const el = ref.current;
      if (el?.open && (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node))) el.open = false;
    };
    document.addEventListener("keydown", close);
    document.addEventListener("click", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("click", close);
    };
  }, []);

  return (
    <details ref={ref} className="relative">
      <summary aria-label={t.reviewMenu} title={t.reviewMenu}
        className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-xl font-bold leading-none text-sand-ink hover:bg-sand-field hover:text-ink [&::-webkit-details-marker]:hidden">
        ⋯
      </summary>
      <form action={saveBookingReview.bind(null, id)} onSubmit={() => { if (ref.current) ref.current.open = false; }}
        className="absolute right-0 z-20 mt-1 w-80 max-w-[calc(100vw-2rem)] space-y-3 rounded-2xl bg-white p-4 text-sm shadow-lg ring-1 ring-sand-line">
        <p className="font-bold">{t.reviewMenu}</p>
        <div className="flex flex-wrap gap-2">
          {(["good", "bad", ""] as const).map((r) => (
            <label key={r} className="cursor-pointer rounded-xl px-3 py-2 font-semibold ring-1 ring-sand-line has-[:checked]:bg-ink has-[:checked]:text-white has-[:checked]:ring-ink">
              <input type="radio" name="review" value={r} defaultChecked={review === r} className="sr-only" />
              {t.review[r]}
            </label>
          ))}
        </div>
        <textarea name="review_note" defaultValue={note} rows={3} maxLength={2000} placeholder={t.reviewNote}
          className="w-full rounded-lg bg-sand-field px-3 py-2 ring-1 ring-sand-line focus:outline-none focus:ring-ink" />
        <button className="w-full rounded-xl bg-ink px-4 py-2.5 font-bold text-white hover:bg-black">{t.reviewSave}</button>
      </form>
    </details>
  );
}
