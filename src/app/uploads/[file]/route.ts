import fs from "node:fs/promises";
import path from "node:path";
import { UPLOADS_DIR } from "@/lib/db";

const TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

// Отдаёт загруженные из админки картинки из data/uploads.
// Имена файлов уникальны, поэтому кешируем навсегда.
export async function GET(_req: Request, ctx: RouteContext<"/uploads/[file]">) {
  const { file } = await ctx.params;
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type || file !== path.basename(file)) return new Response("Not found", { status: 404 });
  try {
    const body = await fs.readFile(path.join(UPLOADS_DIR, file));
    return new Response(body, {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
