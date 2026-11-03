import { handleUpdate } from "@/lib/telegram";

/** Вебхук Telegram-бота: команды и кнопки броней. Telegram присылает секрет из setWebhook в заголовке — без него 401. */
export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }
  await handleUpdate(await request.json());
  return Response.json({ ok: true });
}
