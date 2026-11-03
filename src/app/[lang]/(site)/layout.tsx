import Link from "next/link";
import { getSettings, localizeSettings, parseSocials } from "@/lib/data";
import { imageUrl, telegramUrl, whatsappUrl } from "@/lib/format";
import { isLang, path, t } from "@/lib/i18n";
import { LangSwitch } from "@/components/LangSwitch";
import { ChatIcon, MobileMenu } from "@/components/MobileMenu";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function SiteLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang: raw } = await params;
  const lang = isLang(raw) ? raw : "en";
  const d = t(lang);
  const s = localizeSettings(await getSettings(), lang);
  const tel = s.phone.replace(/[^\d+]/g, "");
  const to = (p: string) => path(lang, p);
  // Мессенджеры (пустое поле в настройках — кнопки нет): в шапке круглыми кнопками с sm, на телефоне — в бургере
  const chats = [
    s.whatsapp && { key: "whatsapp", href: whatsappUrl(s.whatsapp, d.whatsappHello), label: "WhatsApp" },
    s.telegram && { key: "telegram", href: telegramUrl(s.telegram, d.whatsappHello), label: "Telegram" },
  ].filter((c): c is { key: "whatsapp" | "telegram"; href: string; label: string } => !!c);
  // Пункты меню — общие для шапки (с md) и бургера на телефоне
  const nav = [
    // В том же порядке, что блоки на главной; «Контакты» не нужны — они в шапке и подвале
    { href: to("/cars"), label: d.nav.cars }, { href: to("/sights"), label: d.nav.sights },
    { href: to("/#reviews"), label: d.nav.reviews }, { href: to("/#about"), label: d.nav.about },
  ];
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href={to("/")} className="flex items-center gap-2" aria-label={`${s.site_name} — ${d.nav.home}`}>
            {s.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- пропорции логотипа заранее неизвестны: фиксируем только высоту
              <img src={imageUrl(s.logo)!} alt="" className="h-9 w-auto max-w-32 object-contain" />
            ) : (
              <span className="grid size-9 place-items-center rounded-lg bg-ink text-sm font-black text-white shadow-[inset_0_-4px_0_var(--brand)]">AN</span>
            )}
            <span className="text-xl font-extrabold tracking-tight">{s.site_name}</span>
          </Link>
          {/* Меню в строку — с xl: на планшете и узком ноутбуке вместе с кнопками шапки оно не помещалось, и кнопки сжимались друг на друга */}
          <nav aria-label={d.nav.aria} className="hidden gap-6 whitespace-nowrap text-sm font-semibold text-slate-700 xl:flex">
            {nav.map((l) => <Link key={l.href} href={l.href} className="hover:text-brand">{l.label}</Link>)}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <LangSwitch lang={lang} />
            <ThemeToggle lang={lang} />
            {chats.map((c) => (
              <a key={c.key} href={c.href} target="_blank" rel="noopener noreferrer" aria-label={c.label} title={c.label}
                className={`hidden size-10 place-items-center rounded-full ring-1 ring-slate-200 sm:grid ${c.key === "whatsapp" ? "text-[#25D366] hover:ring-[#25D366]" : "text-[#229ED9] hover:ring-[#229ED9]"}`}>
                <ChatIcon kind={c.key} />
              </a>
            ))}
            <MobileMenu label={d.nav.menu} links={nav} phone={{ href: `tel:${tel}`, label: s.phone }} chats={chats} />
            <a href={`tel:${tel}`} className="hidden rounded-full bg-brand px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-dark sm:block">
              {s.phone}
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer id="contacts" className="scheme-fixed mt-24 bg-ink text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-3">
          <div>
            <p className="text-xl font-extrabold text-white">{s.site_name}</p>
            <p className="mt-3 text-sm leading-6">{s.hero_title}. {s.hero_subtitle}</p>
          </div>
          <address className="not-italic text-sm leading-7">
            <p className="mb-1 font-bold text-white">{d.footer.contacts}</p>
            <a href={`tel:${tel}`} className="block hover:text-white">{s.phone}</a>
            {s.whatsapp && (
              <a href={whatsappUrl(s.whatsapp, d.whatsappHello)} target="_blank" rel="noopener noreferrer" className="block hover:text-white">WhatsApp</a>
            )}
            {s.telegram && (
              <a href={telegramUrl(s.telegram, d.whatsappHello)} target="_blank" rel="noopener noreferrer" className="block hover:text-white">Telegram</a>
            )}
            {s.email && <a href={`mailto:${s.email}`} className="block hover:text-white">{s.email}</a>}
            {s.address && <p>{s.address}</p>}
          </address>
          <div className="text-sm leading-7 md:text-right">
            <p className="mb-1 font-bold text-white">{d.footer.social}</p>
            {parseSocials(s.socials).map((x) => (
              <a key={x.url} href={x.url} target="_blank" rel="noopener noreferrer me" className="block hover:text-white">{x.name}</a>
            ))}
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 text-xs text-slate-500">
            <p>© {s.site_name}. {d.footer.rights}</p>
            <nav aria-label={d.footer.legal} className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Link href={to("/privacy")} className="hover:text-white">{d.footer.privacy}</Link>
              <Link href={to("/terms")} className="hover:text-white">{d.footer.terms}</Link>
              <Link href="/admin" rel="nofollow" className="rounded-full px-3 py-1 ring-1 ring-white/20 hover:text-white hover:ring-white/50">{d.footer.login}</Link>
            </nav>
          </div>
        </div>
      </footer>
    </>
  );
}
