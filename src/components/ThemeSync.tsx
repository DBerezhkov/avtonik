"use client";

import { useLayoutEffect } from "react";

/**
 * Тема после смены языка: /ru и / — один корневой layout с разным [lang], при переходе React пересоздаёт
 * <html> и снимает с него класс .dark (его ставит THEME_SCRIPT только при загрузке страницы).
 * До отрисовки возвращаем тему из сохранённого выбора — так же, как THEME_SCRIPT.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("theme");
    } catch {}
    const dark = saved === "dark" || (!saved && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  }, []);
  return null;
}
