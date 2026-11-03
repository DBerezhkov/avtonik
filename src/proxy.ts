import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE, verifyToken } from "@/lib/session";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Админка: быстрый редирект без сессии. Полная проверка — в requireAdmin().
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    // Вход по паролю и вход из мини-аппа Telegram (по подписи initData) — без сессии
    if (pathname === "/admin/login" || pathname === "/admin/tg") return NextResponse.next();
    const role = await verifyToken(req.cookies.get(SESSION_COOKIE)?.value);
    if (!role) return NextResponse.redirect(new URL("/admin/login", req.url));
    // Вход из мини-аппа Telegram — только брони (и до отрисовки: редирект из страницы при потоковой отдаче был бы 200)
    if (role === "telegram" && pathname !== "/admin/bookings") return NextResponse.redirect(new URL("/admin/bookings", req.url));
    return NextResponse.next();
  }

  // Английский — язык по умолчанию и живёт без префикса: /en/cars -> 308 на /cars (без дублей для поисковиков).
  const en = pathname === "/en" || pathname.startsWith("/en/");
  const ru = pathname === "/ru" || pathname.startsWith("/ru/");
  const prefix = ru ? "/ru" : "";
  const rest = en || ru ? pathname.slice(3) || "/" : pathname;
  const redirect = (to: string) => {
    const url = req.nextUrl.clone(); // сохраняет ?type=&from=&to=
    url.pathname = to;
    return NextResponse.redirect(url, 308);
  };

  // Страница машины: несуществующий slug -> честный HTTP 404 для поисковиков
  // (иначе Next отдаёт App Shell со статусом 200 и noindex — это soft-404).
  const car = /^\/cars\/([^/]+)$/.exec(rest);
  if (car) {
    const slug = car[1];
    const exists = db.prepare("SELECT 1 FROM cars WHERE slug = ? AND is_published = 1").get(slug);
    if (!exists) {
      // Slug сменили в админке -> постоянный редирект, чтобы не терять позиции и старые ссылки.
      const moved = db.prepare(`SELECT c.slug FROM car_slug_history h JOIN cars c ON c.id = h.car_id
        WHERE h.slug = ? AND c.is_published = 1`).get(slug) as { slug: string } | undefined;
      if (moved) return redirect(`${prefix}/cars/${moved.slug}`); // сразу на конечный адрес, без цепочки через /en
      return NextResponse.rewrite(new URL("/_not-found", req.url), { status: 404 });
    }
  }

  // Страница места: несуществующий slug -> честный HTTP 404 (как у машин)
  const sight = /^\/sights\/([^/]+)$/.exec(rest);
  if (sight && !db.prepare("SELECT 1 FROM sights WHERE slug = ? AND is_published = 1").get(sight[1])) {
    return NextResponse.rewrite(new URL("/_not-found", req.url), { status: 404 });
  }

  if (en) return redirect(rest);
  if (ru) return NextResponse.next();
  // Английская версия внутри приложения — app/[lang] с lang = "en"
  const url = req.nextUrl.clone();
  url.pathname = `/en${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Всё, кроме служебного: _next, API, загруженных фото, sitemap/robots и файлов с расширением
  matcher: ["/((?!_next/|api/|uploads/|sitemap\\.xml|robots\\.txt|.*\\.[a-zA-Z0-9]+$).*)"],
};
