import { cookies } from "next/headers";
import { TelegramLogin } from "./TelegramLogin";
import { AdminLangProvider } from "@/components/admin/AdminLang";
import { LiveRefresh } from "@/components/admin/AdminHeader";
import { MiniBookings } from "./MiniBookings";
import { adminT } from "@/lib/admin-i18n";
import { getAdminLang } from "@/lib/admin-lang";
import { SESSION_COOKIE, verifyToken } from "@/lib/session";

// Мини-апп Telegram (кнопка «Открыть» в боте): сразу список броней. Первый раз — тихий вход по подписи Telegram.
// Сессия и язык — из cookie, поэтому на каждый запрос.
export const instant = false;

export default async function TelegramPage({ searchParams }: PageProps<"/admin/tg">) {
  const lang = await getAdminLang();
  const t = adminT(lang);
  const signedIn = !!(await verifyToken((await cookies()).get(SESSION_COOKIE)?.value));
  const brand = <span>Avto<span className="text-brand">Nik</span></span>;

  if (!signedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand px-4 text-ink">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-sm ring-1 ring-sand-line">
          <p className="mb-4 text-xl font-extrabold tracking-tight">{brand} <span className="text-sm font-semibold text-sand-ink">{t.admin}</span></p>
          <TelegramLogin error={t.tg.notInTelegram} wait={t.tg.wait} />
        </div>
      </div>
    );
  }

  const { s } = await searchParams;
  return (
    <AdminLangProvider lang={lang}>
      <TelegramLogin error="" wait="" signedIn />
      <LiveRefresh />
      <MiniBookings lang={lang} status={Array.isArray(s) ? s[0] : s} />
    </AdminLangProvider>
  );
}
