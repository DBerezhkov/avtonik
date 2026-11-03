import { Manrope } from "next/font/google";

// Общие для корневых layout'ов сайта, админки и global-not-found.
export const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin", "cyrillic"] });

/** Тема до первой отрисовки, без белой вспышки: сохранённая или системная. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;
