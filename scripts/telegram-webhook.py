"""Подключить бота к сайту на сервере (один раз после деплоя или смены домена/токена):

    python3 scripts/telegram-webhook.py https://autonik.rentals

Telegram будет сам присылать нажатия кнопок и команды на <сайт>/api/telegram с секретом TELEGRAM_WEBHOOK_SECRET,
а кнопка «Открыть» у поля ввода откроет мини-апп <сайт>/admin/tg (мини-аппы Telegram работают только по https).
Нужны TELEGRAM_BOT_TOKEN и TELEGRAM_WEBHOOK_SECRET — те же, что в окружении сервера.
"""
import json, sys, urllib.request

env = dict(l.split("=", 1) for l in open(".env.local").read().splitlines() if "=" in l and not l.startswith("#"))
token, secret = env.get("TELEGRAM_BOT_TOKEN", "").strip(), env.get("TELEGRAM_WEBHOOK_SECRET", "").strip()
if len(sys.argv) < 2 or not sys.argv[1].startswith("https://"):
    raise SystemExit("Укажите адрес сайта с https://, например: python3 scripts/telegram-webhook.py https://autonik.rentals")
if not token or not secret:
    raise SystemExit("Нужны TELEGRAM_BOT_TOKEN и TELEGRAM_WEBHOOK_SECRET в .env.local")


def api(method, **params):
    req = urllib.request.Request(f"https://api.telegram.org/bot{token}/{method}", json.dumps(params).encode(), {"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=30))


url = sys.argv[1].rstrip("/") + "/api/telegram"
print(api("setWebhook", url=url, secret_token=secret, allowed_updates=["message", "callback_query"]))
print(api("setMyCommands", commands=[{"command": "bookings", "description": "Брони"}]))
# Кнопка «Открыть» слева от поля ввода — открывает мини-апп (страница броней админки, вход по подписи Telegram)
print(api("setChatMenuButton", menu_button={"type": "web_app", "text": "Открыть", "web_app": {"url": sys.argv[1].rstrip("/") + "/admin/tg"}}))
print("Вебхук:", api("getWebhookInfo")["result"])
