import "server-only";
import { db } from "./db";
import { adminT } from "./admin-i18n";
import { readSettings } from "./data";
import type { Lang } from "./i18n";

// Отзывы и рейтинг из Google через официальный Places API (New).
// Нужен ключ GOOGLE_PLACES_API_KEY (Google Cloud -> APIs -> Places API (New)).
// Places API отдаёт рейтинг, общее число отзывов и до 5 самых релевантных отзывов.

const API = () => (process.env.GOOGLE_PLACES_API_BASE || "https://places.googleapis.com").replace(/\/$/, "");

/** CID места из ссылки «Оставить отзыв» (g.page/r/<token>/review) или из maps.google.com/?cid=. */
export function cidFromUrl(url: string): string | null {
  const cid = url.match(/[?&]cid=(\d+)/)?.[1];
  if (cid) return cid;
  const token = url.match(/g\.page\/r\/([A-Za-z0-9_-]+)/)?.[1];
  if (!token) return null;
  const bytes = Buffer.from(token, "base64url");
  // protobuf: поле 1, тип fixed64 (тег 0x09), затем 8 байт little-endian
  return bytes[0] === 0x09 && bytes.length >= 9 ? bytes.readBigUInt64LE(1).toString() : null;
}

export function googleMapsUrl(reviewUrl: string) {
  const cid = cidFromUrl(reviewUrl);
  return cid ? `https://maps.google.com/?cid=${cid}` : null;
}

type PlaceReview = {
  name: string;
  rating: number;
  relativePublishTimeDescription?: string;
  publishTime?: string;
  text?: { text: string };
  originalText?: { text: string };
  authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
};

async function places<T>(path: string, fieldMask: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
      "X-Goog-FieldMask": fieldMask,
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `Places API: HTTP ${res.status}`);
  return body as T;
}

/** Находит place_id по CID из ссылки на отзывы (текстовый поиск + сверка googleMapsUri). */
async function resolvePlaceId(cid: string, query: string) {
  const { places: found = [] } = await places<{ places?: { id: string; googleMapsUri?: string }[] }>(
    "/v1/places:searchText",
    "places.id,places.googleMapsUri",
    { method: "POST", body: JSON.stringify({ textQuery: query, languageCode: "ru" }) },
  );
  return found.find((p) => p.googleMapsUri?.includes(`cid=${cid}`))?.id ?? null;
}

/** Загружает рейтинг и отзывы из Google в БД. Кеш сайта сбрасывает вызывающий код (тег "reviews"). */
export async function syncGoogleReviews(lang: Lang = "ru"): Promise<{ ok: boolean; message: string }> {
  const e = adminT(lang).errors; // сообщение показывается в админке на её языке
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return { ok: false, message: e.noPlacesKey };
  }
  const s = readSettings();
  try {
    let placeId = s.google_place_id;
    if (!placeId) {
      const cid = cidFromUrl(s.google_review_url);
      if (!cid) return { ok: false, message: e.noReviewUrl };
      placeId = (await resolvePlaceId(cid, `${s.site_name} ${s.address || s.city}`)) ?? "";
      if (!placeId) return { ok: false, message: e.placeNotFound };
    }

    const place = await places<{ rating?: number; userRatingCount?: number; reviews?: PlaceReview[] }>(
      `/v1/places/${encodeURIComponent(placeId)}?languageCode=ru`,
      "id,rating,userRatingCount,reviews",
    );
    const reviews = place.reviews ?? [];

    const set = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    const ins = db.prepare(`INSERT INTO reviews (id, author, author_url, author_photo, rating, text, relative_time, published_at, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    db.transaction(() => {
      set.run("google_place_id", placeId);
      set.run("google_rating", place.rating != null ? String(place.rating) : "");
      set.run("google_rating_count", place.userRatingCount != null ? String(place.userRatingCount) : "");
      set.run("reviews_synced_at", new Date().toISOString());
      db.prepare("DELETE FROM reviews").run();
      reviews.forEach((r, i) =>
        ins.run(
          r.name,
          r.authorAttribution?.displayName ?? "Пользователь Google",
          r.authorAttribution?.uri ?? "",
          r.authorAttribution?.photoUri ?? "",
          r.rating,
          r.text?.text ?? r.originalText?.text ?? "",
          r.relativePublishTimeDescription ?? "",
          r.publishTime ?? "",
          i,
        ),
      );
    })();
    return { ok: true, message: e.synced(String(place.rating ?? "—"), place.userRatingCount ?? 0, reviews.length) };
  } catch (err) {
    return { ok: false, message: e.placesError((err as Error).message) };
  }
}
