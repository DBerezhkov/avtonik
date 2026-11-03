import type { Metadata } from "next";
import { adminT } from "@/lib/admin-i18n";
import { getAdminLang } from "@/lib/admin-lang";
import { SITE_URL } from "@/lib/format";
import { manrope } from "@/lib/fonts";
import "../globals.css";

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(SITE_URL),
    title: adminT(await getAdminLang()).title,
    robots: { index: false, follow: false },
  };
}

// Отдельный корневой layout: у сайта корень в app/[lang], у админки свой язык интерфейса (cookie admin_lang)
// и только светлая тема (песочная палитра, как в старой админке).
export default async function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang={await getAdminLang()} className={`${manrope.variable} h-full antialiased`}>
      <body className="min-h-full bg-sand font-sans">{children}</body>
    </html>
  );
}
