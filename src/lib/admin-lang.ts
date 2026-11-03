import "server-only";
import { cookies } from "next/headers";
import { ADMIN_LANG_COOKIE, adminLang } from "./admin-i18n";

/** Язык интерфейса админки из cookie admin_lang (по умолчанию русский). */
export async function getAdminLang() {
  return adminLang((await cookies()).get(ADMIN_LANG_COOKIE)?.value);
}
