"""Показывает chat_id для TELEGRAM_CHAT_ID (уведомления о заявках).

1. Создайте бота у @BotFather, токен — в .env.local: TELEGRAM_BOT_TOKEN=...
2. Напишите боту любое сообщение (или добавьте его в группу и напишите там).
3. python3 scripts/telegram-chat-id.py [@username] — выведет чаты, откуда боту писали;
   если TELEGRAM_CHAT_ID в .env.local пуст — впишет туда чат с этим @username (или единственный чат).
"""
import sys
import json
import urllib.request

env = dict(l.split("=", 1) for l in open(".env.local").read().splitlines() if "=" in l and not l.startswith("#"))
token = env.get("TELEGRAM_BOT_TOKEN", "").strip()
if not token:
    raise SystemExit("В .env.local нет TELEGRAM_BOT_TOKEN — сначала получите токен у @BotFather.")

updates = json.load(urllib.request.urlopen(f"https://api.telegram.org/bot{token}/getUpdates", timeout=15))["result"]
chats = {}
for u in updates:
    msg = u.get("message") or u.get("channel_post") or u.get("my_chat_member") or {}
    chat = msg.get("chat")
    if chat:
        chats[chat["id"]] = (chat.get("username") or "", chat.get("title") or " ".join(filter(None, [chat.get("first_name"), chat.get("last_name")])))
if not chats:
    raise SystemExit("Боту ещё никто не писал. Напишите ему сообщение и запустите скрипт снова.")
for cid, (user, name) in chats.items():
    print(f"TELEGRAM_CHAT_ID={cid}    # {name} @{user}")

want = sys.argv[1].lstrip("@").lower() if len(sys.argv) > 1 else ""
pick = [cid for cid, (user, _) in chats.items() if user.lower() == want] if want else list(chats)
if env.get("TELEGRAM_CHAT_ID", "").strip():
    print("TELEGRAM_CHAT_ID в .env.local уже задан — не трогаю.")
elif len(pick) == 1:
    lines = [l for l in open(".env.local").read().splitlines() if not l.startswith("TELEGRAM_CHAT_ID=")]
    open(".env.local", "w").write("\n".join(lines + [f"TELEGRAM_CHAT_ID={pick[0]}"]) + "\n")
    print(f"Записал TELEGRAM_CHAT_ID={pick[0]} в .env.local — перезапустите next dev.")
else:
    print("Не понял, какой чат вписать: укажите @username или впишите TELEGRAM_CHAT_ID вручную.")
