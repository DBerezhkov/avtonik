"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { imageUrl } from "@/lib/format";
import { useAdminT } from "./AdminLang";

type Img = { id: number; file: string };

/**
 * Фото машины или места в модалке: первое — главное (MAIN), порядок меняется перетаскиванием (сохраняется сразу),
 * крестик удаляет фото. Плитка «+» добавляет новые: они видны превью и загружаются при «Сохранить»
 * (файлы лежат в скрытом <input name="images"> этой же формы).
 */
export function Photos({ ownerId, images, resync, onDelete, onReorder }: {
  ownerId?: number; // id машины/места; у новой записи нет — перестановка недоступна до сохранения
  images: Img[];
  resync: unknown;
  onDelete: (imageId: number) => Promise<void>;
  onReorder: (ownerId: number, imageIds: number[]) => Promise<void>;
}) {
  const router = useRouter();
  const t = useAdminT().photos;
  const [order, setOrder] = useState(images);
  const [drag, setDrag] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [added, setAdded] = useState<{ file: File; url: string }[]>([]);
  const input = useRef<HTMLInputElement>(null);

  // Новые данные с сервера (после удаления/перестановки) — подхватываем без эффекта
  const [prevImages, setPrevImages] = useState(images);
  if (images !== prevImages) {
    setPrevImages(images);
    setOrder(images);
  }
  // Превью (blob:) освобождаем при закрытии модалки
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // Скрытый input держит все выбранные файлы (выбор в несколько заходов накапливается)
  const sync = (list: { file: File }[]) => {
    const dt = new DataTransfer();
    list.forEach((a) => dt.items.add(a.file));
    if (input.current) input.current.files = dt.files;
  };
  // После ошибки сохранения React сбрасывает форму (и input type=file) — возвращаем выбранные файлы
  useEffect(() => sync(added), [resync]); // eslint-disable-line react-hooks/exhaustive-deps -- нужен только момент ответа action
  const addFiles = (files: FileList | null) => {
    if (!files?.length) return sync(added); // отмена диалога выбора очищает input — восстанавливаем
    const fresh = [...files].map((file) => ({ file, url: URL.createObjectURL(file) }));
    urls.current.push(...fresh.map((a) => a.url));
    const next = [...added, ...fresh];
    setAdded(next);
    sync(next);
  };
  const removeAdded = (i: number) => {
    URL.revokeObjectURL(added[i].url);
    const next = added.filter((_, j) => j !== i);
    setAdded(next);
    sync(next);
  };

  const drop = (to: number) => {
    if (drag === null || drag === to || !ownerId || pending) return setDrag(null);
    const next = [...order];
    const [moved] = next.splice(drag, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    setDrag(null);
    start(async () => {
      try {
        await onReorder(ownerId, next.map((i) => i.id));
      } catch {
        setOrder(images); // не сохранилось — возвращаем как было
      } finally {
        router.refresh();
      }
    });
  };

  const remove = (id: number) => {
    if (!confirm(t.confirmDelete)) return;
    setOrder((o) => o.filter((i) => i.id !== id));
    start(async () => {
      try {
        await onDelete(id);
      } catch {
        setOrder(images);
      } finally {
        router.refresh();
      }
    });
  };

  const tile = "relative aspect-square overflow-hidden rounded-2xl ring-1 ring-sand-line";
  return (
    <div>
      <ul className={`grid grid-cols-3 gap-3 sm:grid-cols-5 ${pending ? "opacity-70" : ""}`}>
        {order.map((img, i) => (
          <li key={img.id} draggable={!pending} onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(i)}
            className={`${tile} group cursor-grab bg-sand ${drag === i ? "opacity-40" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- миниатюра в админке, без оптимизации */}
            <img src={imageUrl(img.file)!} alt="" className="size-full object-cover" draggable={false} />
            {i === 0 && <span className="absolute left-2 top-2 rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-extrabold text-white">MAIN</span>}
            <button type="button" onClick={() => remove(img.id)} disabled={pending} aria-label={t.delete}
              className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-white/90 text-sm font-bold text-red-600 opacity-0 shadow transition group-hover:opacity-100 focus:opacity-100">×</button>
          </li>
        ))}
        {added.map((a, i) => (
          <li key={a.url} className={`${tile} group bg-sand`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- превью выбранного файла (blob:) */}
            <img src={a.url} alt="" className="size-full object-cover opacity-80" />
            <span className="absolute bottom-2 left-2 rounded-md bg-ink/80 px-1.5 py-0.5 text-[10px] font-bold text-white">{t.fresh}</span>
            {order.length === 0 && i === 0 && <span className="absolute left-2 top-2 rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-extrabold text-white">MAIN</span>}
            <button type="button" onClick={() => removeAdded(i)} aria-label={t.remove}
              className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-white/90 text-sm font-bold text-red-600 shadow">×</button>
          </li>
        ))}
        <li>
          <button type="button" onClick={() => input.current?.click()} aria-label={t.add}
            className="grid aspect-square w-full place-items-center rounded-2xl border-2 border-dashed border-sand-line hover:border-brand">
            <span className="grid size-10 place-items-center rounded-full bg-brand/10 text-xl font-bold text-brand">+</span>
          </button>
        </li>
      </ul>
      <input ref={input} type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple hidden
        onChange={(e) => { const files = e.target.files; if (files) addFiles(files); }} />
      <p className="mt-2 text-xs text-sand-ink">
        {t.hint}{added.length > 0 && t.freshHint}
      </p>
    </div>
  );
}
