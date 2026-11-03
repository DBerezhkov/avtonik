"use client";

import Link from "next/link";
import { usePopover } from "./usePopover";

type Chat = { key: "whatsapp" | "telegram"; href: string; label: string };

/** Иконки мессенджеров (контуры логотипов, цвет — currentColor). */
export function ChatIcon({ kind, className = "size-5" }: { kind: Chat["key"]; className?: string }) {
  return kind === "whatsapp" ? (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.4-.3Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.8 8.8-7.9c.4-.3-.1-.5-.6-.2L6.6 13.4 2 12c-1-.3-1-1 .2-1.5l18.3-7c.8-.3 1.6.2 1.4 1.8Z" />
    </svg>
  );
}

/** Меню для узкого экрана (основная навигация в шапке видна с md): кнопка в стиле EN/темы и выпадающий список. */
export function MobileMenu({ label, links, phone, chats }: { label: string; links: { href: string; label: string }[]; phone: { href: string; label: string }; chats: Chat[] }) {
  const { open, setOpen, ref } = usePopover<HTMLDivElement>();
  const item = "block rounded-xl px-4 py-3 font-semibold hover:bg-slate-100 dark:hover:bg-white/10";
  return (
    <div ref={ref} className="relative md:hidden">
      <button type="button" onClick={() => setOpen(!open)} aria-label={label} aria-expanded={open} aria-controls="mobile-menu"
        className="grid size-10 place-items-center rounded-full ring-1 ring-slate-200 hover:ring-brand">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <nav id="mobile-menu" aria-label={label}
          className="absolute right-0 top-full z-40 mt-3 w-[min(18rem,calc(100vw-2rem))] rounded-2xl bg-surface p-2 text-fg shadow-2xl ring-1 ring-slate-200">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={item}>{l.label}</Link>
          ))}
          <a href={phone.href} className="mt-1 block rounded-xl bg-brand px-4 py-3 text-center font-bold text-white hover:bg-brand-dark">{phone.label}</a>
          {chats.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {chats.map((c) => (
                <a key={c.key} href={c.href} target="_blank" rel="noopener noreferrer"
                  className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 font-bold text-white ${c.key === "whatsapp" ? "bg-[#25D366]" : "bg-[#229ED9]"} ${chats.length === 1 ? "col-span-2" : ""}`}>
                  <ChatIcon kind={c.key} />{c.label}
                </a>
              ))}
            </div>
          )}
        </nav>
      )}
    </div>
  );
}
