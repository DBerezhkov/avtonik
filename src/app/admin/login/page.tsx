import { LoginForm } from "./LoginForm";
import { AdminLangProvider } from "@/components/admin/AdminLang";
import { adminT } from "@/lib/admin-i18n";
import { getAdminLang } from "@/lib/admin-lang";

// Язык интерфейса — из cookie, поэтому страница рендерится на каждый запрос.
export const instant = false;

export default async function LoginPage() {
  const lang = await getAdminLang();
  const t = adminT(lang);
  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-4 text-ink">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-sm ring-1 ring-sand-line">
        <p className="text-xl font-extrabold tracking-tight">Avto<span className="text-brand">Nik</span> <span className="text-sm font-semibold text-sand-ink">{t.admin}</span></p>
        <h1 className="mt-4 text-2xl font-extrabold">{t.login.title}</h1>
        <AdminLangProvider lang={lang}>
          <LoginForm />
        </AdminLangProvider>
      </div>
    </div>
  );
}
