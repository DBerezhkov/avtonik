import "server-only";

/** Центр Батуми — Площадь Европы. От неё считается расстояние до мест. */
export const BATUMI_CENTER = { lat: 41.6516, lng: 41.6366 };

/**
 * Расстояние и время в пути на машине от центра Батуми по дорогам (публичный сервер OSRM, без ключа).
 * null — сервис недоступен или маршрута нет: тогда поля просто остаются пустыми, сохранение не ломается.
 */
export async function roadFromBatumi(lat: number, lng: number): Promise<{ km: number; min: number } | null> {
  const { lat: lat0, lng: lng0 } = BATUMI_CENTER;
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${lng0},${lat0};${lng},${lat}?overview=false`, {
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { code: string; routes?: { distance: number; duration: number }[] };
    const r = data.code === "Ok" ? data.routes?.[0] : undefined;
    if (!r) return null;
    // Время — с шагом 5 минут: точнее всё равно не угадать с пробками и серпантином
    return { km: Math.max(1, Math.round(r.distance / 1000)), min: Math.max(5, Math.round(r.duration / 300) * 5) };
  } catch {
    return null;
  }
}

type Point = { lat: number; lng: number };

const point = (lat: string, lng: string): Point | null => {
  const p = { lat: Number(lat), lng: Number(lng) };
  return Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && (p.lat !== 0 || p.lng !== 0) ? p : null;
};

/** Точка из адреса Google Maps: метка места (!3d…!4d…), затем q/query/ll/center=lat,lng, затем центр карты (@lat,lng). */
export function coordsInMapsUrl(raw: string): Point | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  // Согласие на cookies (EU): настоящий адрес — в continue
  const next = url.hostname.startsWith("consent.") && url.searchParams.get("continue");
  if (next) return coordsInMapsUrl(next);
  const text = decodeURIComponent(url.href);
  const pin = [...text.matchAll(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/g)].at(-1);
  if (pin) return point(pin[1], pin[2]);
  for (const key of ["q", "query", "ll", "center", "destination"]) {
    const m = url.searchParams.get(key)?.match(/^\s*(-?\d+\.\d+)\s*,\s*\+?(-?\d+\.\d+)\s*$/);
    if (m) return point(m[1], m[2]);
  }
  const path = url.pathname.match(/\/(?:place|search|dir)\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/) ?? text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  return path ? point(path[1], path[2]) : null;
}

/**
 * Координаты по ссылке Google Maps. Короткую ссылку «Поделиться» (maps.app.goo.gl) раскрываем по редиректам —
 * в полном адресе есть точка. Ссылки вида ?cid=… координат не содержат (и страница их не отдаёт) — тогда null.
 */
export async function coordsFromMapsUrl(raw: string): Promise<Point | null> {
  const direct = coordsInMapsUrl(raw);
  if (direct) return direct;
  let host = "";
  try {
    host = new URL(raw).hostname;
  } catch {
    return null;
  }
  if (host !== "maps.app.goo.gl" && host !== "goo.gl") return null;
  try {
    let url = raw;
    for (let i = 0; i < 5; i++) {
      const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(8000) });
      const loc = res.headers.get("location");
      if (!loc) return null;
      url = new URL(loc, url).href;
      const found = coordsInMapsUrl(url);
      if (found) return found;
    }
  } catch {
    // сеть недоступна — координаты просто не заполнятся
  }
  return null;
}
