import type { Metadata } from "next";
import { THEME_SCRIPT, manrope } from "@/lib/fonts";
import "./globals.css";

// 404 для адресов, которые не совпали ни с одним маршрутом (язык неизвестен — показываем оба).
export const metadata: Metadata = { title: "404 — Page not found", robots: { index: false } };

export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${manrope.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans">
        <div className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="text-3xl font-bold">Page not found</h1>
          <p className="mt-2 text-lg text-slate-600">Страница не найдена</p>
          <div className="mt-8 flex justify-center gap-3">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- вне дерева layout'ов, обычные ссылки */}
            <a href="/" className="rounded-full bg-brand px-6 py-3 font-semibold text-white">Home</a>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/ru" className="rounded-full px-6 py-3 font-semibold ring-1 ring-slate-300">На главную</a>
          </div>
        </div>
      </body>
    </html>
  );
}
