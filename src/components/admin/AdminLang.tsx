"use client";

import { createContext, use } from "react";
import { adminT } from "@/lib/admin-i18n";
import type { Lang } from "@/lib/i18n";

// Язык интерфейса админки для клиентских компонентов; выставляется в (panel)/layout и на странице входа.
const AdminLangContext = createContext<Lang>("ru");

export function AdminLangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <AdminLangContext value={lang}>{children}</AdminLangContext>;
}

export const useAdminLang = () => use(AdminLangContext);
export const useAdminT = () => adminT(use(AdminLangContext));
