import Link from "next/link";
import { Photo } from "@/components/Photo";
import { adminT } from "@/lib/admin-i18n";
import type { Lang } from "@/lib/i18n";
import { ConfirmButton, btnOutline } from "./ui";

/** Карточка в сетке админки: фото со статусом, название, подпись, цена, «Изменить / Удалить». */
export function AdminCard({ lang, image, published, title, subtitle, price, editHref, onDelete, deleteMessage, badgeWhenPublished = true }: {
  lang: Lang;
  image: string | null;
  published: boolean;
  /** false — плашку «Доступна» не показывать (у мест), только «Скрыто» для скрытых */
  badgeWhenPublished?: boolean;
  title: string;
  subtitle: string;
  price?: string;
  editHref: string;
  onDelete: () => Promise<void>;
  deleteMessage: string;
}) {
  const t = adminT(lang);
  return (
    <li className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-sand-line transition hover:shadow-lg">
      <Link href={editHref} scroll={false} className="relative block aspect-[16/10] bg-sand">
        {image && <Photo src={image} alt="" fill sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />}
        {(!published || badgeWhenPublished) && (
          <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow ${published ? "bg-green-700" : "bg-slate-500"}`}>
            {published ? t.card.available : badgeWhenPublished ? t.card.hiddenF : t.card.hiddenN}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="truncate text-lg font-bold text-ink">{title}</h3>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <p className="truncate text-sm text-sand-ink">{subtitle}</p>
          {price && <p className="shrink-0 text-sm text-sand-ink"><span className="text-xl font-extrabold text-brand">{price}</span> {t.card.perDay}</p>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link href={editHref} scroll={false} className={btnOutline}>{t.edit}</Link>
          <ConfirmButton action={onDelete} message={deleteMessage}>{t.delete}</ConfirmButton>
        </div>
      </div>
    </li>
  );
}
