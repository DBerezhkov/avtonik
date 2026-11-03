"""Telegram-бот на локалке: Telegram не достучится до localhost, поэтому забираем обновления сами (getUpdates)
и пересылаем их в /api/telegram dev-сервера — тот же обработчик, что на проде получает вебхуком.

    python3 scripts/telegram-poll.py [http://localhost:3000]

Снимает вебхук (если был), пока работает — бот отвечает на кнопки и /bookings. На сервере вместо этого —
scripts/telegram-webhook.py (отдельный процесс там не нужен).
"""
import json, sys, time, urllib.error, urllib.request

env = dict(l.split("=", 1) for l in open(".env.local").read().splitlines() if "=" in l and not l.startswith("#"))
token, secret = env.get("TELEGRAM_BOT_TOKEN", "").strip(), env.get("TELEGRAM_WEBHOOK_SECRET", "").strip()
if not token or not secret:
    raise SystemExit("Нужны TELEGRAM_BOT_TOKEN и TELEGRAM_WEBHOOK_SECRET в .env.local")
site = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000").rstrip("/")


def api(method, **params):
    req = urllib.request.Request(f"https://api.telegram.org/bot{token}/{method}", json.dumps(params).encode(), {"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=60))["result"]


api("deleteWebhook")
api("setMyCommands", commands=[{"command": "bookings", "description": "Брони"}])
print(f"Бот @{api('getMe')['username']} слушает, обновления -> {site}/api/telegram (Ctrl+C — выход)")
offset = 0
while True:
    try:
        for u in api("getUpdates", offset=offset, timeout=50, allowed_updates=["message", "callback_query"]):
            offset = u["update_id"] + 1
            req = urllib.request.Request(f"{site}/api/telegram", json.dumps(u).encode(),
                                         {"Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": secret})
            try:
                urllib.request.urlopen(req, timeout=30)
                what = (u.get("callback_query") or {}).get("data") or (u.get("message") or {}).get("text", "")
                print("->", what)
            except urllib.error.URLError as e:
                print("сайт не ответил:", e)
    except (urllib.error.URLError, TimeoutError) as e:
        print("Telegram недоступен, повтор через 5 с:", e)
        time.sleep(5)
