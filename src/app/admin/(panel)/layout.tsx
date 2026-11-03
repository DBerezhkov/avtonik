import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminLangProvider } from "@/components/admin/AdminLang";
import { getAdminLang } from "@/lib/admin-lang";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { TG_COOKIE, requireAdmin } from "@/lib/session";

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin("bookings"); // доступ к самой странице проверяет она сама; заодно делает layout динамическим: счётчики — на момент запроса, а не сборки
  // Счётчики для шапки («28 машин»): все, включая скрытые
  const count = (sql: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${sql}`).get() as { n: number }).n;
  return (
    <AdminLangProvider lang={await getAdminLang()}>
      <div className="min-h-screen bg-sand text-ink">
        <AdminHeader cars={count("cars")} sights={count("sights")} bookings={count("bookings")} newBookings={count("bookings WHERE status = 'new'")}
          telegram={(await cookies()).get(TG_COOKIE)?.value === "1"} />
        <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">{children}</div>
      </div>
    </AdminLangProvider>
  );
}
