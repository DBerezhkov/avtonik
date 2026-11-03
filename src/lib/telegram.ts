import "server-only";
import { revalidateTag } from "next/cache";
import { NEXT, bookingTotal, canDelete, changeStatus, nights, readBooking, removeBooking, type Step } from "./bookings";
import { db } from "./db";
import { readSettings, type Booking, type BookingStatus } from "./data";
import { formatPrice, whatsappUrl } from "./format";

/**
 * Брони в Telegram: уведомление о новой заявке и управление ими прямо в чате (то же, что вкладка «Брони»).
 * TELEGRAM_BOT_TOKEN — от @BotFather; TELEGRAM_CHAT_ID — кому писать и кому можно управлять (через запятую);
 * TELEGRAM_WEBHOOK_SECRET — секрет вебхука /api/telegram. Без токена и чатов бот молчит, заявки работают как обычно.
 */
const API = () => (process.env.TELEGRAM_API_BASE || "https://api.telegram.org").replace(/\/$/, "");
const chats = () => (process.env.TELEGRAM_CHAT_ID || "").split(",").map((c) => c.trim()).filter(Boolean);

type Button = { text: string; callback_data?: string; url?: string };
type Keyboard = { inline_keyboard: Button[][] };

async function tg(method: string, body: object) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    const res = await fetch(`${API()}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    // «message is not modified» — нажали ту же кнопку дважды, это не ошибка
    if (!res.ok) {
      const err = await res.text();
      if (!err.includes("message is not modified")) console.error(`Telegram ${method}: ${res.status} ${err}`);
    }
  } catch (err) {
    console.error(`Telegram ${method}:`, err);
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const day = (v: string) => new Date(`${v}T00:00:00Z`).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" });

const STATUS: Record<BookingStatus, string> = { new: "🟠 Новая", confirmed: "🟢 В работе", done: "⚪️ Выполнена", cancelled: "✖️ Отклонена" };
const LISTS: Record<BookingStatus, string> = { new: "🟠 Новые", confirmed: "🟢 В работе", done: "⚪️ Выполненные", cancelled: "✖️ Отклонённые" };
const STEP: Record<Step, string> = { confirm: "✅ Подтвердить", cancel: "✖️ Отклонить", returned: "🔑 Вернули машину" };
const ORDER: BookingStatus[] = ["new", "confirmed", "done", "cancelled"];

/** Карточка заявки: текст как в админке и кнопки по статусу. */
function card(b: Booking, header?: string): { text: string; reply_markup: Keyboard } {
  const { currency } = readSettings();
  const total = bookingTotal(b);
  const text = [
    header && `<b>${header}</b>`,
    `${STATUS[b.status]} · <b>#${b.id}</b>`,
    `<b>${esc(b.car_name)}</b>`,
    `📅 ${day(b.date_from)} → ${day(b.date_to)} (${nights(b.date_from, b.date_to)} сут.)`,
    b.pickup && `📍 ${esc(b.pickup)}`,
    total != null && `💰 ${formatPrice(total, currency)}`,
    `👤 ${esc(b.name)}`,
    `📞 ${esc(b.phone)} · <a href="${esc(whatsappUrl(b.phone, `Здравствуйте, ${b.name}! Это по вашей заявке на ${b.car_name}.`))}">WhatsApp</a>`,
    b.comment && `💬 ${esc(b.comment)}`,
  ].filter(Boolean).join("\n");
  const actions: Button[] = NEXT[b.status].map(([to, step]) => ({ text: STEP[step], callback_data: `s:${b.id}:${to}` }));
  if (canDelete(b.status)) actions.push({ text: "🗑 Удалить", callback_data: `d:${b.id}` });
  return { text, reply_markup: { inline_keyboard: [...(actions.length ? [actions] : []), [{ text: "📋 Все брони", callback_data: "m" }]] } };
}

/** Меню: списки по статусам со счётчиками. */
function menu(): { text: string; reply_markup: Keyboard } {
  const counts = Object.fromEntries((db.prepare("SELECT status, COUNT(*) n FROM bookings GROUP BY status").all() as { status: string; n: number }[])
    .map((r) => [r.status, r.n]));
  return {
    text: "<b>Брони</b>\nВыберите список:",
    reply_markup: { inline_keyboard: ORDER.map((s) => [{ text: `${LISTS[s]} (${counts[s] ?? 0})`, callback_data: `l:${s}` }]) },
  };
}

/** Список заявок одного статуса кнопками (свежие сверху, до 30). */
function list(status: BookingStatus): { text: string; reply_markup: Keyboard } {
  const rows = db.prepare("SELECT * FROM bookings WHERE status = ? ORDER BY created_at DESC, id DESC LIMIT 30").all(status) as Booking[];
  const button = (b: Booking) => {
    const label = `#${b.id} · ${day(b.date_from)}–${day(b.date_to)} · ${b.car_name} · ${b.name}`;
    return [{ text: label.length > 60 ? `${label.slice(0, 59)}…` : label, callback_data: `b:${b.id}` }];
  };
  return {
    text: rows.length ? `<b>${LISTS[status]}</b> — ${rows.length}` : `<b>${LISTS[status]}</b>\nПусто.`,
    reply_markup: { inline_keyboard: [...rows.map(button), [{ text: "← Меню", callback_data: "m" }]] },
  };
}

/** Новая заявка с сайта — карточка с кнопками всем чатам из TELEGRAM_CHAT_ID. */
export async function notifyNewBooking(id: number) {
  const b = readBooking(id);
  if (!b || !process.env.TELEGRAM_BOT_TOKEN) return;
  const view = card(b, "🚗 Новая заявка");
  await Promise.all(chats().map((chat_id) => tg("sendMessage", { chat_id, ...view, parse_mode: "HTML", link_preview_options: { is_disabled: true } })));
}

type Update = {
  message?: { chat: { id: number }; text?: string };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number }; message_id: number } };
};

/** Обработка входящего от Telegram (вебхук /api/telegram): команды и нажатия кнопок. Чужим чатам — отказ. */
export async function handleUpdate(u: Update) {
  if (u.message) {
    const chat_id = u.message.chat.id;
    if (!chats().includes(String(chat_id))) {
      await tg("sendMessage", { chat_id, text: `Нет доступа. Ваш chat_id: ${chat_id}` });
      return;
    }
    await tg("sendMessage", { chat_id, ...menu(), parse_mode: "HTML" });
    return;
  }

  const q = u.callback_query;
  if (!q?.message || !q.data) return;
  const chat_id = q.message.chat.id;
  if (!chats().includes(String(chat_id))) {
    await tg("answerCallbackQuery", { callback_query_id: q.id, text: "Нет доступа", show_alert: true });
    return;
  }
  const [kind, rawId, arg] = q.data.split(":");
  const id = Number(rawId);
  let view: { text: string; reply_markup: Keyboard } | undefined;
  let toast = "";

  if (kind === "m") view = menu();
  else if (kind === "l" && ORDER.includes(rawId as BookingStatus)) view = list(rawId as BookingStatus);
  else if (kind === "s" && ORDER.includes(arg as BookingStatus)) {
    if (changeStatus(id, arg as BookingStatus)) {
      revalidateTag("bookings", { expire: 0 }); // занятость машин на сайте — сразу
      toast = STATUS[arg as BookingStatus];
    } else toast = "Статус уже изменён";
  } else if (kind === "d") {
    const b = readBooking(id);
    if (b && canDelete(b.status)) {
      view = {
        text: `${card(b).text}\n\n<b>Удалить заявку #${b.id}?</b>`,
        reply_markup: { inline_keyboard: [[{ text: "🗑 Да, удалить", callback_data: `D:${id}` }, { text: "Отмена", callback_data: `b:${id}` }]] },
      };
    }
  } else if (kind === "D") {
    if (removeBooking(id)) {
      revalidateTag("bookings", { expire: 0 });
      toast = "Заявка удалена";
      view = { text: `🗑 Заявка #${id} удалена.`, reply_markup: { inline_keyboard: [[{ text: "📋 Все брони", callback_data: "m" }]] } };
    } else toast = "Удалить нельзя";
  }
  // Карточка (после смены статуса и по «b:») — свежая из базы; заявки уже нет — сообщаем
  if (!view && kind !== "m" && kind !== "l") {
    const b = readBooking(id);
    view = b ? card(b) : { text: `Заявки #${id} больше нет.`, reply_markup: { inline_keyboard: [[{ text: "📋 Все брони", callback_data: "m" }]] } };
  }

  await tg("answerCallbackQuery", { callback_query_id: q.id, ...(toast && { text: toast }) });
  if (view) {
    await tg("editMessageText", {
      chat_id, message_id: q.message.message_id, ...view, parse_mode: "HTML", link_preview_options: { is_disabled: true },
    });
  }
}
