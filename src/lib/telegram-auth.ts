import "server-only";
import crypto from "node:crypto";

/**
 * Проверка initData мини-аппа Telegram (core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
 * подпись HMAC-SHA256 ключом от токена бота, свежесть (сутки), пользователь — из TELEGRAM_CHAT_ID.
 * Возвращает id пользователя или null.
 */
export function verifyInitData(initData: string, maxAgeSec = 24 * 3600): number | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const check = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const key = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const expected = crypto.createHmac("sha256", key).update(check).digest("hex");
  if (hash.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected))) return null;
  if (!(Date.now() / 1000 - Number(params.get("auth_date")) < maxAgeSec)) return null;
  let id: number | undefined;
  try {
    id = JSON.parse(params.get("user") || "{}").id;
  } catch {
    return null;
  }
  const allowed = (process.env.TELEGRAM_CHAT_ID || "").split(",").map((c) => c.trim());
  return id && allowed.includes(String(id)) ? id : null;
}
