"""Сквозная проверка сайта и админки по HTTP (без браузера).

Тест меняет данные (отзывы из мока Google, тестовая машина), поэтому гоняется на КОПИИ базы:
    npm run build
    rm -rf /tmp/autonik-e2e && cp -r data /tmp/autonik-e2e
    DATA_DIR=/tmp/autonik-e2e GOOGLE_PLACES_API_KEY=test GOOGLE_PLACES_API_BASE=http://127.0.0.1:3999 \
      TELEGRAM_BOT_TOKEN=test TELEGRAM_CHAT_ID=42 TELEGRAM_API_BASE=http://127.0.0.1:3998 TELEGRAM_WEBHOOK_SECRET=e2e-secret \
      npx next start -p 3100
    python3 scripts/e2e.py [http://localhost:3100]
В копии должен быть пустой google_place_id (так после npm run import).
"""
import html, io, json, re, subprocess, sys, threading, urllib.error, urllib.parse, urllib.request, uuid
from http.server import BaseHTTPRequestHandler, HTTPServer

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3100"
ENV = dict(l.split("=", 1) for l in open(".env.local").read().splitlines() if "=" in l)
cookies = {}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a):
        return None


opener = urllib.request.build_opener(NoRedirect)


def req(path, fields=None, files=None):
    data, headers = None, {}
    if cookies:
        headers["Cookie"] = "; ".join(f"{k}={v}" for k, v in cookies.items())
    if fields is not None:
        b = uuid.uuid4().hex
        buf = io.BytesIO()
        for k, v in fields:
            buf.write(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        for k, name, content in files or []:
            buf.write(f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{name}"\r\nContent-Type: image/png\r\n\r\n'.encode())
            buf.write(content + b"\r\n")
        buf.write(f"--{b}--\r\n".encode())
        data, headers["Content-Type"] = buf.getvalue(), f"multipart/form-data; boundary={b}"
    try:
        r = opener.open(urllib.request.Request(BASE + path, data=data, headers=headers))
    except urllib.error.HTTPError as e:
        r = e
    for c in r.headers.get_all("Set-Cookie") or []:
        k, v = c.split(";")[0].split("=", 1)
        cookies[k] = v
    return r.status, r.headers.get("Location", ""), r.read().decode("utf-8", "replace")


def form_fields(page, marker):
    """Скрытые поля React-формы (progressive enhancement) — первая форма с server action, содержащая marker."""
    forms = [f for f in re.findall(r"<form[^>]*>(.*?)</form>", page, re.S) if "$ACTION" in f and marker in f]
    return [(html.unescape(n), html.unescape(v)) for n, v in re.findall(r'<input type="hidden" name="([^"]*)"(?: value="([^"]*)")?', forms[0])]


def check(cond, msg):
    print(("OK   " if cond else "FAIL ") + msg)
    if not cond:
        sys.exit(1)


# 1. Публичная часть
st, _, home = req("/")
check(st == 200 and "application/ld+json" in home, "главная 200 + JSON-LD")
ld = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', home).group(1))
check([g["@type"] for g in ld["@graph"]] == ["AutoRental"], "JSON-LD главной: AutoRental")
check(len(re.findall(r'href="/cars/[a-z0-9-]+"', home)) == 6 and 'href="/cars"' in home, "на главной 6 машин и ссылка на каталог")
check(home.count("Map ↗</a>") == 6 and 'href="/sights"' in home, "на главной 6 мест и ссылка на все места")
check('action="/cars"' in home and 'name="from"' in home and 'name="type"' in home, "форма поиска на главной")
st, _, cars_page = req("/cars?type=suv&from=2026-12-01&to=2026-12-05")
cars_ld = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', cars_page).group(1))
check(st == 200 and cars_ld["@graph"][0]["@type"] == "ItemList" and len(cars_ld["@graph"][0]["itemListElement"]) == len(set(re.findall(r'href="(/cars/[a-z0-9-]+)"', cars_page))),
      "/cars: 200, все машины в HTML и в ItemList")
st, _, sights_page = req("/sights")
check(st == 200 and "Фото:" not in sights_page and "Wikimedia" not in sights_page and "TouristAttraction" in sights_page,
      "/sights: 200, без авторов фото")
check("Wikimedia" not in home and 'href="/privacy"' in home and 'href="/terms"' in home and 'href="/admin"' in home,
      "подвал: без авторов фото, ссылки на политику, условия и вход")
st, _, privacy = req("/ru/privacy")
check(st == 200 and "Политика конфиденциальности" in privacy and "avtonikrental@gmail.com" in privacy, "/ru/privacy: 200, текст с autonik.rentals")
st, _, terms = req("/ru/terms")
check(st == 200 and "Требования к арендатору" in terms and "Бесплатная отмена" in terms, "/ru/terms: 200, текст с autonik.rentals")
check("Privacy Policy" in req("/privacy")[2] and "Requirements for the Renter" in req("/terms")[2].replace("<!-- -->", ""), "/privacy и /terms на английском")

# 1a. Языки: английский по умолчанию без префикса, русский — /ru
CYR = re.compile(r"[А-Яа-яЁё]")
def visible(h):
    h = re.sub(r"<script.*?</script>", "", h, flags=re.S)
    return re.sub(r"<[^>]+>", " ", h)
check('<html lang="en"' in home and "Car Rental in Batumi" in home, "главная по умолчанию на английском")
st, _, ru_home = req("/ru")
check(st == 200 and '<html lang="ru"' in ru_home and "Аренда автомобилей в Батуми" in ru_home and 'href="/ru/cars"' in ru_home, "/ru — русская версия, ссылки с префиксом")
st, loc, _ = req("/en/cars?type=suv")
check(st == 308 and loc.endswith("/cars?type=suv"), f"/en/... -> 308 без префикса ({st} {loc})")
for u in ["/", "/cars", "/sights", "/privacy", "/terms", "/cars/ford-escape-2016"]:
    st, _, h = req(u)
    cyr = CYR.findall(visible(h))
    check(st == 200 and not cyr, f"EN {u}: 200, в видимом тексте нет кириллицы ({''.join(cyr[:20])})")
check('hrefLang="ru" href="http' in home and 'hrefLang="x-default"' in home, "hreflang-ссылки на главной")
check('href="/ru"' in home and 'href="/"' in ru_home, "переключатель языка в шапке")
check("Why choose us" in home and "24/7 support" in home and "Belyaev" not in home and "Почему выбирают нас" in ru_home and "Беляев" not in ru_home,
      "блок «Почему выбирают нас» вместо блока о владельце")
check('aria-controls="mobile-menu"' in home and 'aria-label="Menu"' in home and 'aria-label="Меню"' in ru_home, "бургер-меню в шапке на обоих языках")
check(re.search(r'<header.*?aria-label="WhatsApp".*?</header>', home, re.S) is not None, "кнопка WhatsApp в шапке")
check(req("/ru/cars/does-not-exist")[0] == 404 and req("/ru/nope")[0] == 404 and req("/nope")[0] == 404, "404 на обоих языках")
sm = req("/sitemap.xml")[2]
check("/ru/cars/ford-escape-2016</loc>" in sm and "/cars/ford-escape-2016</loc>" in sm and "xhtml:link" in sm, "sitemap: оба языка + hreflang")
check(req("/cars/does-not-exist")[0] == 404, "несуществующая машина -> 404")
# Страницы мест: адрес из английского названия, карточки ведут на них, 404 и sitemap
st, _, sight_page = req("/sights/machakhela-national-park")
check(st == 200 and "<h1" in sight_page and "Machakhela National Park" in sight_page and "maps.google.com" in sight_page and ".webp" in sight_page,
      f"страница места: заголовок, фото, ссылка на карту ({st})")
check(req("/ru/sights/machakhela-national-park")[0] == 200 and "Национальный парк Мачахела" in req("/ru/sights/machakhela-national-park")[2], "страница места на русском")
sl = req("/sights")[2]
check('href="/sights/machakhela-national-park"' in sl and "32 km from Batumi" in sl and "Sea</span>" in sl and "Details →" not in sl
      and "Coast · any car" not in sl and re.search(r'right-3 top-3[^>]*>(Any car|Crossover / SUV|4×4 / AWD)<', sl),
      "карточка в «Куда поехать»: ссылка на страницу места, на фото — расстояние и нужная машина, внизу — маршрут")
check("км от Батуми" in req("/ru")[2], "на главной у мест плашка с расстоянием")
check(req("/sights/does-not-exist")[0] == 404 and req("/ru/sights/does-not-exist")[0] == 404, "несуществующее место -> 404")
check("/sights/machakhela-national-park</loc>" in sm and "/ru/sights/machakhela-national-park</loc>" in sm, "sitemap: страницы мест")
check(req("/admin")[0] in (302, 303, 307), "админка без входа -> редирект")

# 2. Вход
_, _, login = req("/admin/login")
st, _, body = req("/admin/login", form_fields(login, 'name="password"') + [("login", "admin"), ("password", "wrong")])
check("Неверный логин или пароль" in body, "неверный пароль отклонён")
st, loc, _ = req("/admin/login", form_fields(login, 'name="password"') + [("login", ENV["ADMIN_LOGIN"]), ("password", ENV["ADMIN_PASSWORD"])])
check("autonik_session" in cookies, f"вход выполнен ({st} -> {loc})")
st, _, admin = req("/admin")
check(st == 200 and "Toyota Prius" in admin and "28 машин" in admin.replace("<!-- -->", ""), "сетка машин в админке, счётчик в шапке")
check("Toyota Prius" not in req("/admin?q=ford")[2] and "Ford Escape" in req("/admin?q=ford")[2], "поиск по машинам (?q=)")
st, _, modal = req("/admin?edit=2")
check(st == 200 and 'role="dialog"' in modal and "Изменить: Kia Sportage" in modal and "MAIN" in modal, "модалка редактирования машины с фото")
st, _, sights_adm = req("/admin/sights?edit=1")
check(st == 200 and "Изменить: Национальный парк Мачахела" in sights_adm and "29 мест" in sights_adm.replace("<!-- -->", ""), "места: сетка и модалка")
# Мок Telegram Bot API: уведомления о новых заявках
tg_sent = []
class Telegram(BaseHTTPRequestHandler):
    def do_POST(self):
        tg_sent.append((self.path, json.loads(self.rfile.read(int(self.headers["Content-Length"])))))
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true,"result":{"message_id":1}}')
    def log_message(self, *a):
        pass
tg_srv = HTTPServer(("127.0.0.1", 3998), Telegram)
threading.Thread(target=tg_srv.serve_forever, daemon=True).start()

# Брони: заявка со страницы машины -> вкладка «Брони» со счётчиком новых
import datetime
# Даты тестовых заявок — после всех настоящих подтверждённых броней этой машины (тест идёт на копии рабочей базы)
_busy_end = max([datetime.date.fromisoformat(b["to"]) for b in json.loads(req("/api/busy?car=1")[2])] or [datetime.date.today()])
_base = max(datetime.date.today(), _busy_end) + datetime.timedelta(days=10)
d1 = _base.isoformat()
d2 = (_base + datetime.timedelta(days=4)).isoformat()
new_count = lambda page: int((re.search(r'aria-label="новых: (\d+)"', page) or [0, 0])[1])
new_before = new_count(req("/admin/bookings")[2])  # в копии рабочей базы могут быть настоящие заявки
car_page = req("/cars/ford-escape-2016")[2]
bf = [(k, v) for k, v in form_fields(car_page, 'name="phone"') if k not in ("from", "to", "pickup")]  # даты подставляем сами
check('name="pickup"' in car_page and 'aria-label="Where will you pick up the car"' in car_page, "выпадашка «где заберёте» в форме брони")
st, _, body = req("/cars/ford-escape-2016", bf + [("from", d1), ("to", d2), ("name", "Тест"), ("phone", "+995 555 11 22 33"), ("comment", ""), ("hp_x7", "")])
check("choose where you will pick up" in body, "заявка без места подачи отклонена")
bf += [("pickup", "2")]  # аэропорт Кутаиси, +$16
st, _, body = req("/cars/ford-escape-2016", bf + [("from", "2020-01-01"), ("to", "2020-01-05"), ("name", "Тест"), ("phone", "+995 555 11 22 33"), ("comment", ""), ("hp_x7", "")])
check("not in the past" in body, "заявка с датами в прошлом отклонена")
st, _, body = req("/cars/ford-escape-2016", bf + [("from", d1), ("to", d2), ("name", "E2E Клиент"), ("phone", "+995 555 11 22 33"), ("comment", "детское кресло"), ("hp_x7", "")])
check("Thank you!" in body, "заявка с сайта отправлена")
import time
for _ in range(20):
    if tg_sent:
        break
    time.sleep(0.25)
tg = tg_sent[0][1] if tg_sent else {}
check(bool(tg_sent) and tg_sent[0][0] == "/bottest/sendMessage" and tg.get("chat_id") == "42" and tg.get("parse_mode") == "HTML"
      and "Новая заявка" in tg.get("text", "") and "Ford Escape 2016" in tg["text"] and "E2E Клиент" in tg["text"]
      and "Kutaisi International Airport (KUT) — $16" in tg["text"] and "детское кресло" in tg["text"],
      f"уведомление о заявке ушло в Telegram: {tg.get('text', '')[:300]!r}")
check(re.search(r'"s:\d+:confirmed"', json.dumps(tg.get("reply_markup"))) is not None and "Отклонить" in json.dumps(tg.get("reply_markup"), ensure_ascii=False),
      "в уведомлении кнопки «Подтвердить» и «Отклонить»")
bk = req("/admin/bookings")[2].replace("<!-- -->", "")
check("E2E Клиент" in bk and "Ford Escape 2016" in bk and "детское кресло" in bk and "4 сут." in bk, "заявка во вкладке «Брони»")
check("📍 Kutaisi International Airport (KUT) — $16" in bk, "место подачи в заявке")
check(new_count(bk) == new_before + 1, f"счётчик новых броней в шапке ({new_before} -> {new_count(bk)})")
st, _, _ = req("/admin/bookings", form_fields(bk, ">Подтвердить</button>"))
bk = req("/admin/bookings")[2]
check("В работе" in bk and new_count(bk) == new_before, "бронь подтверждена — статус «В работе», счётчик вернулся")
# Автозаполнение браузера (поле «website») не должно выкидывать заявку; заполненная ловушка — выкидывает
# (даты — после подтверждённой выше брони d1 -> d2: на её даты машина уже занята)
f1 = (datetime.date.fromisoformat(d2) + datetime.timedelta(days=10)).isoformat()
f2 = (datetime.date.fromisoformat(d2) + datetime.timedelta(days=12)).isoformat()
req("/cars/ford-escape-2016", bf + [("from", f1), ("to", f2), ("name", "E2E Автозаполнение"), ("phone", "+995 555 11 22 33"), ("comment", ""), ("website", "https://example.com"), ("hp_x7", "")])
req("/cars/ford-escape-2016", bf + [("from", f1), ("to", f2), ("name", "E2E Бот"), ("phone", "+995 555 11 22 33"), ("comment", ""), ("hp_x7", "spam")])
bk = req("/admin/bookings")[2]
check("E2E Автозаполнение" in bk and "E2E Бот" not in bk, "заявка с автозаполненным «website» доходит, бот с заполненной ловушкой — нет")
# «Отклонить» -> «Отклонена», заявка уходит в свёрнутый «Архив» внизу; удалить бронь нельзя нигде.
# Первая «Отклонить» — у самой свежей новой заявки, то есть у только что отправленной тестовой.
req("/admin/bookings", form_fields(bk, ">Отклонить</button>"))
bk = req("/admin/bookings")[2].replace("<!-- -->", "")
arch = bk.split(">Архив · ", 1)
check(len(arch) == 2 and "E2E Автозаполнение" in arch[1] and "E2E Автозаполнение" not in arch[0] and "Отклонена" in arch[1],
      "отклонённая заявка — в «Архиве» внизу списка")
check(re.search(r"<details(?![^>]*\bopen)[^>]*>\s*<summary[^>]*>Архив", bk) is not None, "«Архив» свёрнут")
check("Удалить</button>" not in bk, "у броней нет кнопки «Удалить»")
# Подтверждённая бронь (E2E Клиент, d1 -> d2) занимает машину: пересечение отклоняется, стык — нет
mid = (datetime.date.fromisoformat(d1) + datetime.timedelta(days=1)).isoformat()
d3 = (datetime.date.fromisoformat(d2) + datetime.timedelta(days=3)).isoformat()
st, _, body = req("/cars/ford-escape-2016", bf + [("from", mid), ("to", d3), ("name", "E2E Пересечение"), ("phone", "+995 555 11 22 33"), ("comment", ""), ("hp_x7", "")])
check("already booked for these dates" in body, "заявка на занятые даты отклонена")
st, _, body = req("/cars/ford-escape-2016", bf + [("from", d2), ("to", d3), ("name", "E2E Стык"), ("phone", "+995 555 11 22 33"), ("comment", ""), ("hp_x7", "")])
check("Thank you!" in body, "заявка с дня возврата предыдущей брони принята")
busy_json = f'\\"from\\":\\"{d1}\\",\\"to\\":\\"{d2}\\"'
check(busy_json in req("/cars")[2], "занятые даты переданы в каталог")
check({"from": d1, "to": d2} in json.loads(req("/api/busy?car=1")[2]), "API занятости для календаря машины отдаёт подтверждённую бронь сразу")
# «В работе» -> «Вернули машину» -> «Выполнена»: у выполненной кнопок нет, машина снова свободна
client_q = "/admin/bookings?q=" + urllib.parse.quote("E2E Клиент")
bk = req(client_q)[2]
check(">Вернули машину</button>" in bk and ">Отклонить</button>" not in bk, "у брони в работе одна кнопка — «Вернули машину»")
req(client_q, form_fields(bk, ">Вернули машину</button>"))
bk = req(client_q)[2]
check("Выполнена" in bk and "Удалить</button>" not in bk and not any(b in bk for b in (">Вернули машину</button>", ">Подтвердить</button>", ">Отклонить</button>")),
      "выполненная бронь — без кнопок, удалить нельзя")
# Отзыв админа через «⋯»: плохой опыт с комментарием — виден на карточке
bk = req(client_q)[2]
req(client_q, form_fields(bk, 'name="review_note"') + [("review", "bad"), ("review_note", "E2E вернул грязную машину")])
bk = req(client_q)[2].replace("<!-- -->", "")
check("👎 Плохой опыт</b> — E2E вернул грязную машину" in bk, "отзыв админа о клиенте сохранён и виден на карточке")
check({"from": d1, "to": d2} not in json.loads(req("/api/busy?car=1")[2]), "после возврата машины даты брони освободились")

# Брони в Telegram-боте: вебхук /api/telegram (секрет, доступ только TELEGRAM_CHAT_ID), меню, кнопки статусов, удаление
def tg_post(update, secret="e2e-secret"):
    r = urllib.request.Request(BASE + "/api/telegram", json.dumps(update).encode(),
                               {"Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": secret})
    try:
        return urllib.request.urlopen(r, timeout=30).status
    except urllib.error.HTTPError as e:
        return e.code
def tg_last(method):
    return next((b for path, b in reversed(tg_sent) if path.endswith("/" + method)), {})
def tg_press(data):
    return tg_post({"update_id": 1, "callback_query": {"id": "q", "data": data, "message": {"chat": {"id": 42}, "message_id": 5}}})
check(tg_post({"update_id": 1, "message": {"chat": {"id": 42}, "text": "/bookings"}}, secret="wrong") == 401, "вебхук бота без секрета -> 401")
tg_post({"update_id": 1, "message": {"chat": {"id": 7}, "text": "/bookings"}})
check("Нет доступа" in tg_last("sendMessage").get("text", "") and tg_last("sendMessage").get("chat_id") == 7, "чужому чату бот отказывает")
tg_post({"update_id": 1, "message": {"chat": {"id": 42}, "text": "/bookings"}})
menu_kb = json.dumps(tg_last("sendMessage").get("reply_markup"), ensure_ascii=False)
check("Новые" in menu_kb and "В работе" in menu_kb and '"l:new"' in menu_kb, "/bookings — меню списков по статусам")
b1 = (datetime.date.fromisoformat(d3) + datetime.timedelta(days=30)).isoformat()
b2 = (datetime.date.fromisoformat(d3) + datetime.timedelta(days=33)).isoformat()
sent_before = len(tg_sent)
req("/cars/ford-escape-2016", bf + [("from", b1), ("to", b2), ("name", "E2E Бот"), ("phone", "+995 555 11 22 44"), ("comment", ""), ("hp_x7", "")])
for _ in range(20):
    if len(tg_sent) > sent_before:
        break
    time.sleep(0.25)
bot_id = re.search(r'"s:(\d+):confirmed"', json.dumps(tg_sent[-1][1].get("reply_markup"))).group(1)
tg_press("l:new")
check(f'"b:{bot_id}"' in json.dumps(tg_last("editMessageText").get("reply_markup")), "список «Новые» в боте — с новой заявкой")
tg_press(f"s:{bot_id}:confirmed")
card = tg_last("editMessageText")
check("В работе" in card.get("text", "") and f'"s:{bot_id}:done"' in json.dumps(card.get("reply_markup"))
      and {"from": b1, "to": b2} in json.loads(req("/api/busy?car=1")[2]), "кнопка «Подтвердить» в боте: «В работе», даты заняты, кнопка «Вернули машину»")
tg_press(f"s:{bot_id}:confirmed")
check(tg_last("answerCallbackQuery").get("text") == "Статус уже изменён", "устаревшая кнопка в боте ничего не меняет")
tg_press(f"s:{bot_id}:done")
check("Выполнена" in tg_last("editMessageText").get("text", "") and {"from": b1, "to": b2} not in json.loads(req("/api/busy?car=1")[2]),
      "«Вернули машину» в боте: выполнена, даты освободились")
check(not re.search(r'"[dD]:', json.dumps(tg_last("editMessageText").get("reply_markup"))), "в боте нет кнопки удаления у выполненной")
tg_press(f"D:{bot_id}")  # старая кнопка «Да, удалить» из прежних сообщений ничего не удаляет
check("E2E Бот" in req("/admin/bookings?q=" + urllib.parse.quote("E2E Бот"))[2], "старая кнопка удаления в боте заявку не удаляет")
# Новая заявка с номера, по которому плохой отзыв (другая запись того же номера) — бот сразу предупреждает
r1 = (datetime.date.fromisoformat(b2) + datetime.timedelta(days=10)).isoformat()
r2 = (datetime.date.fromisoformat(b2) + datetime.timedelta(days=12)).isoformat()
sent_before = len(tg_sent)
req("/cars/ford-escape-2016", bf + [("from", r1), ("to", r2), ("name", "E2E Повтор"), ("phone", "8 555 112233"), ("comment", ""), ("hp_x7", "")])
for _ in range(20):
    if len(tg_sent) > sent_before:
        break
    time.sleep(0.25)
rep_txt = tg_sent[-1][1].get("text", "") if len(tg_sent) > sent_before else ""
check("ПЛОХОЙ ОПЫТ с этим номером" in rep_txt and "«E2E вернул грязную машину»" in rep_txt and re.search(r"🔁 Уже обращался: \d+ заяв", rep_txt) is not None,
      f"бот предупреждает о клиенте с плохим отзывом и пишет, сколько было заявок: {rep_txt[:300]!r}")
bk = req("/admin/bookings?q=" + urllib.parse.quote("E2E Повтор"))[2].replace("<!-- -->", "")
check("ring-red-500" in bk and "⚠️ У клиента есть плохие отзывы (1)" in bk and "«E2E вернул грязную машину»" in bk,
      "в админке новая заявка клиента с плохим отзывом — красная рамка и плашка")
check(not re.search(r"Booked [A-Z][a-z]{2} ", req("/cars")[2]), "в каталоге без дат плашки «Booked …» с датами нет (занятость — в календаре машины)")
check(not re.search(r"Занята \d", req("/ru/cars")[2] + req("/ru")[2]), "плашки «Занята 12–16 …» нет ни в русском каталоге, ни на главной")
ru_cars = req("/ru/cars")[2].replace("<!-- -->", "")
check(re.search(r'aria-pressed="false"[^>]*>.{0,400}Свободные.{0,200}?</button><button[^>]*>Все', ru_cars, re.S) is not None,
      "в каталоге перед «Все» кнопка-переключатель «Свободные»")
st, _, deliv = req("/admin/delivery")
check(st == 200 and "Международный аэропорт Батуми" in deliv and "<textarea" not in deliv, "вкладка «Подача» — таблицей, без текстовых полей")
pts = json.loads(html.unescape(re.search(r'name="points" value="([^"]*)"', deliv).group(1)))
dform = [(k, v) for k, v in form_fields(deliv, 'name="points"') if k != "points"]
st, _, body = req("/admin/delivery", dform + [("points", json.dumps(pts + [{"name": "", "name_en": "No name", "price": "5"}]))])
check("нужно название на русском" in body, "пункт подачи без русского названия не сохраняется")
kut = next(i for i, p in enumerate(pts) if "Кутаиси" in p["name"])
changed = [dict(p, price=("21" if i == kut else p["price"])) for i, p in enumerate(pts)]
st, loc, _ = req("/admin/delivery", dform + [("points", json.dumps(changed))])
check("saved=1" in (loc or ""), f"пункты подачи сохранены ({st} {loc})")
req("/ru/cars/ford-escape-2016"), req("/cars/ford-escape-2016")  # первый запрос после сброса кеша ещё отдаёт старую страницу и запускает пересборку
ru_car, en_car = req("/ru/cars/ford-escape-2016")[2], req("/cars/ford-escape-2016")[2]
check(all(re.search(r'\\?"price\\?":21[,}]', pg) for pg in (ru_car, en_car)) and "Car delivery" not in en_car and "Подача автомобиля" not in ru_car,
      "новая доплата в выпадашке подачи на странице машины, одна для RU и EN; отдельного блока «Подача» нет")
req("/admin/delivery", dform + [("points", json.dumps(pts))])

# 3. Создание машины с фото
png = subprocess.run(["node", "-e", "require('sharp')({create:{width:900,height:600,channels:3,background:'#3a6'}})"
                      ".png().toBuffer().then(b=>process.stdout.write(b))"], capture_output=True, check=True).stdout
_, _, new = req("/admin?new=1")
car = [("name", "Test Car"), ("year", "2024"), ("category", "suv"), ("price_per_day", "123"),
       ("price_1_3", "120"), ("price_4_7", "110"), ("price_8_30", "100"), ("price_30_plus", ""),
       ("transmission", "manual"), ("fuel", "diesel"), ("seats", "5"), ("luggage", "2"),
       ("description", "Тестовое описание"), ("is_published", "on")]
st, loc, body = req("/admin?new=1", form_fields(new, 'name="price_per_day"') + car, files=[("images", "a.png", png)])
m = re.search(r"/admin\?saved=(\d+)", loc + body)
check(m is not None, f"машина создана ({st} {loc}) {re.findall(r'role=\"alert\"[^>]*>([^<]*)', body)}")
car_id = m.group(1)

st, _, page = req("/cars/test-car-2024")
check(st == 200 and "Test Car 2024" in page and ".webp" in page, "страница новой машины видна сразу (updateTag) с webp-фото")
check("8–30 days" in page and "$100" in page and "31+ days" not in page, "цены по срокам аренды показаны (пустая ступень скрыта)")
check(">Make<" not in page and ">Model<" not in page and ">Body type<" not in page, "на странице машины нет марки, модели и кузова")
# Ключа ANTHROPIC_API_KEY в тесте нет: перевод не делается, машина всё равно сохраняется
check("Тестовое описание" in page, "без перевода английская страница показывает русское описание")
ru_page = req("/ru/cars/test-car-2024")[2]
check("Тестовое описание" in ru_page and "8–30 суток" in ru_page, "русская страница машины: описание и цены по срокам")
car_ld = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', page).group(1))["@graph"][0]
check(car_ld["@type"] == "Car" and car_ld["offers"]["price"] == 100 and len(car_ld["offers"]["priceSpecification"]) == 3,
      "JSON-LD Car: цена «от» и 3 ступени UnitPriceSpecification")
check("Test Car 2024" in req("/cars")[2], "машина появилась в каталоге")
img = re.search(r"/uploads/(test-car-2024-[0-9a-f]+\.webp)", page).group(1)
check(req("/uploads/" + img)[0] == 200, "загруженное фото отдаётся")

# 4. Вызов server action без сессии (POST на "/", мимо proxy-матчера) не должен ничего создать
saved_cookies = dict(cookies)
cookies.clear()
before = req("/")[2].count("Hack Car")
req("/", form_fields(new, 'name="price_per_day"') + [(k, "Hack Car" if k == "name" else v) for k, v in car])
cookies.update(saved_cookies)
check("Hack Car" not in req("/admin")[2], "server action без сессии не выполнился")

# 5. Ошибка валидации сохраняет введённое; смена названия -> новый адрес, 308 со старого
_, _, edit = req(f"/admin?edit={car_id}")
bad = [(k, "1900" if k == "year" else ("Сохранись" if k == "description" else v)) for k, v in car]
st, _, body = req(f"/admin?edit={car_id}", form_fields(edit, 'name="price_per_day"') + bad)
check("Неверный год выпуска" in body and "Сохранись" in body, "ошибка показана, введённые поля не потеряны")
st, _, _ = req(f"/admin?edit={car_id}", form_fields(edit, 'name="price_per_day"') + car)
check(req("/cars/test-car-2024")[0] == 200, "сохранение без смены названия не меняет адрес")
renamed = [(k, "Test Car Renamed" if k == "name" else v) for k, v in car]
st, loc, _ = req(f"/admin?edit={car_id}", form_fields(edit, 'name="price_per_day"') + renamed)
st, loc, _ = req("/cars/test-car-2024")
check(st == 308 and loc.endswith("/cars/test-car-renamed-2024"), f"старый slug -> 308 на новый ({st} {loc})")
st, loc, _ = req("/ru/cars/test-car-2024")
check(st == 308 and loc.endswith("/ru/cars/test-car-renamed-2024"), f"старый slug на /ru -> 308 на /ru/... ({st} {loc})")
check(req("/cars/test-car-renamed-2024")[0] == 200, "новый адрес открывается")

# 6. Удаление
_, _, grid = req("/admin?q=test")  # в сетке остаётся одна тестовая машина — её форма «Удалить»
st, loc, _ = req("/admin?q=test", form_fields(grid, "Удалить</button>"))
check(req("/cars/test-car-renamed-2024")[0] == 404, "после удаления страница машины -> 404")
check(req("/cars/test-car-2024")[0] == 404, "после удаления старый slug тоже -> 404")
check("Test Car 2024" not in req("/cars")[2], "машина пропала из каталога")
check(req("/uploads/" + img)[0] == 404, "фото удалено с диска")
# 6б. Фильтры: новое направление в админке -> место в нём -> фильтр на сайте; удаление занятого и пустого фильтра
def cat_form(page, kind, item_id=None, delete=False, button=None):
    """Поля формы фильтра (панель «Фильтры» в разделе): добавление (без id), сохранение или удаление конкретного.
    Удаление — кнопка с formAction в той же форме: браузер шлёт поля формы и имя этой кнопки."""
    for f in re.findall(r"<form[^>]*>(.*?)</form>", page, re.S):
        if "$ACTION" not in f or f'name="kind" value="{kind}"' not in f:
            continue
        has_id = re.search(r'name="id" value="(\d+)"', f)
        if (item_id is None and not has_id) or (has_id and int(has_id.group(1)) == item_id):
            fields = [(html.unescape(n), html.unescape(v)) for n, v in re.findall(r'<input type="hidden" name="([^"]*)"(?: value="([^"]*)")?', f)]
            if delete or button:
                fields.append((re.search(rf'<button[^>]*aria-label="{button or "Удалить"}"[^>]*name="([^"]+)"', f).group(1), ""))
            return fields
    raise AssertionError("форма фильтра не найдена")

_, _, cars_adm_f = req("/admin?filters=1")
_, _, filt = req("/admin/sights?filters=1")
check("Кроссовер" in cars_adm_f and "<details open" in cars_adm_f and "Водопады" in filt, "панели «Фильтры» в разделах машин и мест")
st, loc, _ = req("/admin/sights?filters=1", cat_form(filt, "sight") + [("name", "Тестовое направление"), ("name_en", "Test area")])
check("saved=" in loc and "/admin/sights?filters=1" in loc, f"фильтр для мест добавлен ({st} {loc})")
_, _, filt = req("/admin/sights?filters=1")
test_cat = int(re.search(r'name="id" value="(\d+)"/>\s*<input[^>]*value="Тестовое направление"', filt).group(1))
suv_cat = int(re.search(r'name="id" value="(\d+)"/>\s*<input[^>]*value="Кроссовер"', cars_adm_f).group(1))
st, loc, _ = req("/admin?filters=1", cat_form(cars_adm_f, "car", suv_cat, delete=True))
check("ferror=used" in loc, f"фильтр с машинами не удаляется ({loc})")
# Порядок категорий — стрелками: вторая категория поднимается на первое место
cat_names = lambda page: re.findall(r'aria-label="Название \(RU\)"[^>]*name="name" value="([^"]*)"', page)
_, _, cars_adm_f = req("/admin?filters=1")
before = cat_names(cars_adm_f)
check('name="sort_order"' not in cars_adm_f and 'aria-label="Выше"' in cars_adm_f, "порядок категорий — стрелками, без чисел")
second = int(re.findall(r'name="kind" value="car"/><input type="hidden" name="id" value="(\d+)"', cars_adm_f)[1])
st, loc, _ = req("/admin?filters=1", cat_form(cars_adm_f, "car", second, button="Выше"))
after = cat_names(req("/admin?filters=1")[2])
check(len(before) > 2 and after[:2] == [before[1], before[0]] and after[2:] == before[2:], f"стрелка «Выше» поменяла категории местами ({before[:2]} -> {after[:2]})")
req("/admin?filters=1", cat_form(req("/admin?filters=1")[2], "car", second, button="Ниже"))
check(cat_names(req("/admin?filters=1")[2]) == before, "стрелка «Ниже» вернула порядок")

# Место с несколькими фото: адрес из названия, галерея на странице, обложка в карточке, удаление
_, _, snew = req("/admin/sights?new=1")
place = [("name", "Тестовое место"), ("name_en", "Test Place"), ("region", "Батуми"), ("region_en", "Batumi"),
         ("category", "test-area"), ("description", "Описание места"),
         ("description_en", "Place description"), ("car_type", "awd"), ("distance_km", "35"), ("drive_min", "70"),
         ("maps_url", "https://www.google.com/maps/place/Test/@41.56,41.58,17z/data=!3m1!4b1!8m2!3d41.5654892!4d41.5838259"), ("lat", ""), ("lng", ""),
         ("sort_order", "99"), ("is_published", "on")]
st, loc, body = req("/admin/sights?new=1", form_fields(snew, 'name="maps_url"') + place,
                    files=[("images", "a.png", png), ("images", "b.png", png)])
check("/admin/sights?saved=" in loc + body, f"место с двумя фото создано ({st} {loc}) {re.findall(r'role=\"alert\"[^>]*>([^<]*)', body)}")
st, _, ppage = req("/sights/test-place")
pimgs = set(re.findall(r"/uploads/(sight-[0-9a-f]+\.webp)", ppage))
check(st == 200 and "Place description" in ppage and len(pimgs) == 2, f"страница нового места: 2 фото в галерее ({st}, {len(pimgs)})")
check("35 km" in ppage and "~1 h 10 min" in ppage and "4×4 / AWD" in ppage and "/cars?type=suv" in ppage,
      "страница места: расстояние, время, нужная машина, ссылка на кроссоверы")
sights_list = req("/sights")[2]
check('href="/sights/test-place"' in sights_list and "35 km from Batumi" in sights_list, "новое место в каталоге: ссылка и плашка с расстоянием")
check(sights_list.count("Test area") >= 2, "новый фильтр на сайте: кнопка фильтра и плашка в карточке места")
_, _, sgrid = req("/admin/sights?q=test")
sid = re.search(r'href="/admin/sights\?[^"]*edit=(\d+)"', sgrid.replace("&amp;", "&")).group(1)
smodal = req(f"/admin/sights?edit={sid}")[2]
check('name="lat"' in smodal and 'value="41.5654892"' in smodal and 'value="41.5838259"' in smodal, "координаты места взяты из ссылки Google Maps")
req("/admin/sights?q=test", form_fields(sgrid, "Удалить</button>"))
check(req("/sights/test-place")[0] == 404 and all(req("/uploads/" + f)[0] == 404 for f in pimgs), "место удалено вместе с фото")
_, _, filt = req("/admin/sights?filters=1")
st, loc, _ = req("/admin/sights?filters=1", cat_form(filt, "sight", test_cat, delete=True))
check("saved=" in loc and "Тестовое направление" not in req("/admin/sights?filters=1")[2], f"пустой фильтр удалён ({loc})")
# 7. Отзывы Google через мок Places API
MOCK_CID = "5498872865796942299"  # из ссылки g.page/r/Cdtp3La8609MEBM/review
calls = []


class Places(BaseHTTPRequestHandler):
    def _send(self, obj):
        body = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        calls.append(("search", self.headers.get("X-Goog-Api-Key"), self.headers.get("X-Goog-FieldMask")))
        self._send({"places": [{"id": "OTHER", "googleMapsUri": "https://maps.google.com/?cid=1"},
                               {"id": "PLACE_OK", "googleMapsUri": f"https://maps.google.com/?cid={MOCK_CID}"}]})

    def do_GET(self):
        calls.append(("details", self.path))
        self._send({"rating": 4.9, "userRatingCount": 37, "reviews": [
            {"name": "places/PLACE_OK/reviews/1", "rating": 5, "relativePublishTimeDescription": "неделю назад",
             "text": {"text": "Отличная машина, всё чисто!"}, "authorAttribution": {"displayName": "Мок Отзывов"}},
            {"name": "places/PLACE_OK/reviews/2", "rating": 4, "text": {"text": "Хорошо"},
             "authorAttribution": {"displayName": "Второй Автор"}}]})

    def log_message(self, *a):
        pass


srv = HTTPServer(("127.0.0.1", 3999), Places)
threading.Thread(target=srv.serve_forever, daemon=True).start()
_, _, sett = req("/admin/settings")
st, _, body = req("/admin/settings", form_fields(sett, "Обновить отзывы из Google"))
check("отзывов в Google: 37" in body, "синхронизация отзывов из Places API (мок)")
check(calls[0][0] == "search" and calls[0][1] == "test" and calls[1] == ("details", "/v1/places/PLACE_OK?languageCode=ru"),
      "place_id найден по CID из ссылки на отзывы, ключ передан в заголовке")
home = req("/ru")[2].replace("<!-- -->", "")  # React разделяет текстовые узлы комментариями
check("4.9" in home and "37 отзывов" in home and "Мок Отзывов" in home and "Отличная машина" in home, "рейтинг и отзывы на главной")
check("37 Google reviews" in req("/")[2].replace("<!-- -->", ""), "рейтинг на английской главной")
check(req("/api/reviews/sync", [])[0] == 401, "cron-роут отзывов без токена -> 401")
srv.shutdown()

# Настройки: цвет темы, логотип, соцсети списком; город в форме не правится и не затирается
_, _, sett = req("/admin/settings")
check('name="city"' not in sett and 'name="brand_color"' in sett and 'name="social_url"' in sett, "в настройках нет поля «Город», есть цвет темы и соцсети")
check(not any(f'name="{k}"' in sett for k in ("hero_title", "hero_subtitle", "hero_image_credit", "city_en", "hero_title_en", "currency")) and 'name="hero_image"' in sett,
      "тексты главного экрана и валюта в настройках не правятся, фото главного экрана — меняется")
base = [("site_name", "AvtoNik"), ("phone", "+995 511 43 63 43")]
st, _, body = req("/admin/settings", form_fields(sett, 'name="site_name"') + base + [("brand_color", "#2563eb"), ("social_name", "TikTok"), ("social_url", "tiktok.com/x")])
check("ссылка, начинающаяся с https://" in body, "соцсеть без https:// отклонена")
st, loc, _ = req("/admin/settings", form_fields(sett, 'name="site_name"') + base + [("brand_color", "#2563eb"),
    ("social_name", "Instagram"), ("social_url", "https://www.instagram.com/autonikrentals"), ("social_name", "TikTok"), ("social_url", "https://www.tiktok.com/@autonik")],
    files=[("logo", "logo.png", png)])
check(st in (302, 303) and "saved=1" in (loc or ""), f"настройки сохранены ({st} -> {loc})")
home = req("/ru")[2]
check("--brand:#2563eb" in home, "цвет темы подставлен на сайт")
check(">TikTok</a>" in home and ">Instagram</a>" in home and ">Facebook</a>" not in home, "соцсети в подвале — из списка")
check(re.search(r'<img src="/uploads/logo-[0-9a-f]+\.webp"', home) is not None and ">AN</span>" not in home, "логотип в шапке вместо значка «AN»")
check("Автомобили в аренду в Батуми" in req("/ru/cars")[2].replace("<!-- -->", ""), "город (Батуми) после сохранения настроек не затёрт")
home = req("/ru")[2]
check("Аренда автомобилей в Батуми" in home and "$" in home, "заголовок главной и валюта после сохранения настроек не затёрты")
_, _, sett = req("/admin/settings")
req("/admin/settings", form_fields(sett, 'name="site_name"') + base + [("brand_color", "#ea580c"), ("logo_remove", "on")])
check(">AN</span>" in req("/ru")[2], "логотип убран — снова значок «AN»")

# Мини-апп Telegram: /admin/tg — вход по подписи initData, сессия пускает только к броням
import hashlib, hmac, time as _t
def init_data(user_id, token="test", age=0):
    p = {"auth_date": str(int(_t.time()) - age), "query_id": "AAE", "user": json.dumps({"id": user_id, "first_name": "Dima"})}
    check_str = "\n".join(f"{k}={v}" for k, v in sorted(p.items()))
    key = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    p["hash"] = hmac.new(key, check_str.encode(), hashlib.sha256).hexdigest()
    return urllib.parse.urlencode(p)
cookies.clear()
st, _, tgp = req("/admin/tg")
check(st == 200 and "telegram-web-app.js" in tgp, "мини-апп /admin/tg открывается без сессии")
tgf = form_fields(tgp, 'name="init_data"')
tgf = [(k, v) for k, v in tgf if k != "init_data"]
for bad, why in ((init_data(42, token="wrong"), "чужая подпись"), (init_data(7), "пользователь не из TELEGRAM_CHAT_ID"), (init_data(42, age=3 * 86400), "старая подпись")):
    st, loc, body = req("/admin/tg", tgf + [("init_data", bad)])
    check("Нет доступа" in body and "autonik_session" not in cookies, f"мини-апп: {why} — вход запрещён")
st, loc, _ = req("/admin/tg", tgf + [("init_data", init_data(42))])
check(loc.endswith("/admin/tg") and "autonik_session" in cookies and cookies.get("admin_tg") == "1", f"мини-апп: вход по подписи Telegram, остаёмся в мини-аппе ({st} {loc})")
st, _, tgb = req("/admin/tg")
check(st == 200 and "E2E Стык" in tgb and ">Подтвердить</button>" in tgb and 'href="/admin/delivery"' not in tgb
      and 'name="init_data"' not in tgb, "мини-апп: сразу список броней с кнопками, без вкладок админки")
check(all(f'href="/admin/tg?s={s_}"' in tgb for s_ in ("new", "confirmed", "done", "cancelled")) and "wa.me/" in tgb and 'href="tel:' in tgb,
      "мини-апп: вкладки статусов, звонок и WhatsApp в карточке")
tgw = req("/admin/tg?s=confirmed")[2]
check(">Вернули машину</button>" in tgw and ">Подтвердить</button>" not in tgw, "мини-апп: вкладка «В работе» — только брони в работе")
for page in ("/admin", "/admin/settings", "/admin/delivery", "/admin/sights"):
    st, loc, _ = req(page)
    check(st in (303, 307) and loc.endswith("/admin/bookings"), f"мини-апп: {page} закрыта, ведёт на брони ({st} {loc})")

print("\nВсе проверки пройдены")
