import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { UPLOADS_DIR } from "./db";

/** Сжимает загруженное фото в webp (макс. 1920px) и возвращает имя файла. */
export async function saveImage(file: File, prefix: string, size = 1920) {
  const name = `${prefix}-${crypto.randomBytes(6).toString("hex")}.webp`;
  await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate()
    .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(UPLOADS_DIR, name));
  return name;
}

export async function removeImage(file: string | null | undefined) {
  if (file) await fs.rm(path.join(UPLOADS_DIR, path.basename(file)), { force: true });
}

/** Файлы из <input type="file" multiple>, без пустых значений. */
export function filesFrom(form: FormData, key: string) {
  return form.getAll(key).filter((f): f is File => f instanceof File && f.size > 0);
}
