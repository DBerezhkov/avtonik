// Языки сайта. Английский — по умолчанию и без префикса (/cars), русский — с префиксом (/ru/cars).
// Внутри приложения оба живут в app/[lang]/…: proxy переписывает /cars -> /en/cars.

export const LOCALES = ["en", "ru"] as const;
export type Lang = (typeof LOCALES)[number];
export const DEFAULT_LANG: Lang = "en";

export const isLang = (v: string): v is Lang => (LOCALES as readonly string[]).includes(v);

/** Публичный адрес страницы на языке: path("ru", "/cars") -> "/ru/cars", path("en", "/cars") -> "/cars". */
export function path(lang: Lang, p: string) {
  if (lang === DEFAULT_LANG) return p;
  if (p === "/") return `/${lang}`;
  return p.startsWith("/#") || p.startsWith("/?") ? `/${lang}${p.slice(1)}` : `/${lang}${p}`;
}

/** Адрес без языкового префикса: "/ru/cars" -> "/cars". */
export function stripLang(p: string) {
  const m = /^\/(en|ru)(?=\/|$)/.exec(p);
  return m ? p.slice(m[0].length) || "/" : p;
}

/** hreflang-ссылки для metadata.alternates.languages. */
export function languages(p: string) {
  return { en: path("en", p), ru: path("ru", p), "x-default": path(DEFAULT_LANG, p) };
}

export const LOCALE_TAG: Record<Lang, string> = { en: "en-US", ru: "ru-RU" };
export const OG_LOCALE: Record<Lang, string> = { en: "en_US", ru: "ru_RU" };

const ruPlural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};
const enPlural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const ru = {
  langName: "Русский",
  nav: { aria: "Основное меню", cars: "Автомобили", reviews: "Отзывы", sights: "Куда поехать", about: "Почему мы", home: "на главную", menu: "Меню" },
  langSwitch: "Language: English",
  theme: { aria: "Переключить светлую/тёмную тему", title: "Светлая / тёмная тема" },
  stars: (v: number) => `Оценка ${v} из 5`,
  footer: { rights: "Все права защищены.", contacts: "Контакты", social: "Мы в соцсетях", legal: "Правовая информация", privacy: "Политика конфиденциальности", terms: "Условия использования", login: "Вход для владельца" },
  whatsappHello: "Здравствуйте! Хочу арендовать автомобиль.",
  breadcrumbs: { aria: "Хлебные крошки", home: "Главная" },
  home: {
    heroAlt: "Кабриолет на горной дороге в Грузии на закате",
    whyUs: "Почему мы",
    carsFrom: (n: number, price: string) => `${n} ${ruPlural(n, "автомобиль", "автомобиля", "автомобилей")} от ${price} в сутки`,
    noHidden: "Без скрытых платежей",
    freeAirport: "Бесплатная подача в аэропорт Батуми",
    support: "Поддержка 24/7 в WhatsApp",
    reviewsBadge: (n: number) => `${n} ${ruPlural(n, "отзыв", "отзыва", "отзывов")} в Google`,
    popularTitle: "Популярные автомобили",
    popularText: "Эконом, кроссоверы, минивэны и премиум — подберём машину под ваш маршрут по Грузии.",
    seeAllCars: (n: number) => `Смотреть все ${n} ${ruPlural(n, "автомобиль", "автомобиля", "автомобилей")}`,
    sightsTitle: (city: string) => `Куда поехать из ${city}`,
    sightsText: "Побережье, горы, каньоны и водопады Аджарии — места, куда удобно доехать на арендованной машине.",
    seeAllSights: (n: number) => `Смотреть все ${n} ${ruPlural(n, "место", "места", "мест")}`,
    reviewsTitle: "Отзывы клиентов",
    reviewsEmpty: "Будем рады вашему отзыву в Google.",
    allReviews: "Все отзывы в Google ↗",
    leaveReview: "Оставить отзыв",
    aboutTitle: "Почему выбирают нас",
    aboutLead: "Поддержка, честные цены и подача туда, где вам удобно.",
    reasons: [
      ["Поддержка 24/7", "Всегда на связи по телефону и в мессенджерах. Поможем выбрать машину, подскажем маршрут и решим любой вопрос в пути."],
      ["Честная цена", "Цена за сутки зависит только от срока аренды и видна сразу. Никаких скрытых платежей и доплат при получении."],
      ["Подача, куда удобно", "Привезём машину в аэропорт, к отелю или в любое место в Батуми — и заберём там же."],
    ] as [string, string][],
    writeWhatsapp: "Написать в WhatsApp",
    writeTelegram: "Написать в Telegram",
    jsonLdRegion: "Аджария",
    jsonLdCountry: "Грузия",
  },
  // Тексты блока «Как это работает» — со старого сайта autonik.rentals
  how: {
    title: "Как это работает",
    lead: "Выберите идеальный автомобиль, заполните короткую форму, а остальное предоставьте нам. Мы подтвердим ваше бронирование и быстро отправим вас в путь.",
    steps: [
      ["Выберите автомобиль", "Изучите наш ассортимент автомобилей и выберите тот, который подходит для вашей поездки."],
      ["Заполните форму", "Введите данные для бронирования и ваши предпочтения."],
      ["Ожидайте звонка", "Расслабьтесь! Наша команда свяжется с вами в ближайшее время для подтверждения бронирования."],
    ] as [string, string][],
  },
  booking: {
    title: "Заявка на бронирование",
    name: "Ваше имя",
    phone: "Телефон / WhatsApp",
    comment: "Комментарий (необязательно)",
    commentPlaceholder: "Время подачи, детское кресло…",
    pickup: "Где заберёте машину",
    pickupFee: "Подача",
    free: "бесплатно",
    submit: "Отправить заявку",
    sending: "Отправка…",
    or: "или",
    done: "Спасибо! Заявка отправлена — мы свяжемся с вами в ближайшее время, чтобы подтвердить бронь.",
    errors: {
      car: "Этот автомобиль сейчас недоступен для бронирования.",
      name: "Укажите имя.",
      phone: "Укажите номер телефона с кодом страны.",
      dates: "Выберите даты получения и возврата (не в прошлом).",
      busy: "На эти даты машина уже забронирована — выберите другие даты или другую машину.",
      comment: "Комментарий слишком длинный.",
      pickup: "Выберите, где заберёте машину.",
    },
  },
  search: { aria: "Поиск автомобиля", from: "Дата получения", to: "Дата возврата", type: "Тип автомобиля", any: "Любой", submit: "Найти авто", calendar: "Календарь дат аренды", done: "Готово", clear: "Сбросить", hintFrom: "Выберите дату получения", hintTo: "Теперь дату возврата" },
  catalog: {
    title: (city: string) => `Автомобили в аренду в ${city}`,
    metaDescription: (site: string) => `Все автомобили ${site}: эконом, кроссоверы, минивэны и премиум. Цены по срокам аренды, подача в аэропорт.`,
    lead: "Нажмите на автомобиль, чтобы посмотреть фото, характеристики и цены по срокам аренды.",
    period: "Даты аренды",
    pricesForPeriod: "Цены указаны за весь срок.",
    resetDates: "Сбросить даты",
    filter: "Фильтр",
    all: "Все",
    free: "Свободные",
  },
  card: { from: "от", perDay: "/ сутки", total: (n: number) => `за ${n} ${ruPlural(n, "день", "дня", "дней")}`, more: "Подробнее →", busy: "Занята на эти даты", seats: (n: number) => `${n} ${ruPlural(n, "место", "места", "мест")}`, rentIn: (name: string, city: string) => `${name} — аренда в ${city}` },
  days: (n: number) => `${n} сут.`,
  tiers: { "1-3": "1–3 суток", "4-7": "4–7 суток", "8-30": "8–30 суток", "31+": "от 31 суток" } as Record<string, string>,
  car: {
    metaTitle: (name: string, city: string, price: string) => `Аренда ${name} в ${city} — от ${price}/сутки`,
    notFound: "Автомобиль не найден",
    loading: "Загрузка…",
    rentIn: (city: string) => `Аренда в ${city}`,
    photo: (name: string, n: number) => `${name} — фото ${n}`,
    description: "Описание",
    specs: (name: string) => `Характеристики ${name}`,
    features: "Оснащение",
    perDayByTerm: "Цена за сутки по сроку аренды",
    deposit: "Депозит",
    minTerm: "Минимальный срок",
    book: "Написать в WhatsApp",
    bookTelegram: "Написать в Telegram",
    call: "Позвонить",
    whatsapp: (name: string, url: string) => `Здравствуйте! Хочу арендовать ${name}. ${url}`,
    labels: {
      year: "Год выпуска", category: "Класс", transmission: "Коробка передач",
      fuel: "Топливо", engine: "Двигатель", drive: "Привод", seats: "Мест", doors: "Дверей", luggage: "Чемоданов", color: "Цвет",
    },
  },
  sights: {
    title: (city: string) => `Куда поехать на машине из ${city}`,
    metaDescription: "Побережье, горы, каньоны и водопады Аджарии и Самегрело: места для поездок на арендованном автомобиле с точками в Google Maps.",
    lead: "Наш авторский список мест в Аджарии и окрестностях: побережье, горы, каньоны и водопады — с фото, описанием и точкой в Google Maps.",
    maps: "На карте ↗",
    crumb: "Куда поехать",
  },
  sight: {
    metaTitle: (name: string, city: string) => `${name} — поездка на машине из ${city}`,
    notFound: "Место не найдено",
    photo: (name: string, n: number) => `${name} — фото ${n}`,
    about: "О месте",
    region: "Регион",
    route: "Направление",
    howToGet: "Как добраться",
    howToGetText: (city: string) => `Из ${city} проще всего добраться на машине. Точка на карте:`,
    rentCar: "Выбрать машину",
    car: "Рекомендуемая машина",
    distance: "От центра Батуми",
    km: (km: number) => `${km} км`,
    fromBatumi: (km: number) => `${km} км от Батуми`,
    time: (min: number) => (min < 60 ? `~${min} мин` : `~${Math.floor(min / 60)} ч${min % 60 ? ` ${min % 60} мин` : ""}`),
  },
  legal: {
    privacyDescription: "Как AvtoNik собирает, использует и хранит персональные данные при бронировании автомобиля в Батуми.",
    termsDescription: "Условия аренды автомобилей AvtoNik в Батуми: требования к водителю, депозит, срок аренды, страховка, отмена бронирования.",
  },
  notFound: { title: "Страница не найдена", text: "Возможно, автомобиль уже снят с аренды.", home: "На главную" },
};

export type Dict = typeof ru;

const en: Dict = {
  langName: "English",
  nav: { aria: "Main menu", cars: "Cars", reviews: "Reviews", sights: "Where to go", about: "Why us", home: "home page", menu: "Menu" },
  langSwitch: "Язык: русский",
  theme: { aria: "Toggle light/dark theme", title: "Light / dark theme" },
  stars: (v) => `Rated ${v} out of 5`,
  footer: { rights: "All rights reserved.", contacts: "Contacts", social: "Follow us", legal: "Legal information", privacy: "Privacy Policy", terms: "Terms and Conditions", login: "Owner login" },
  whatsappHello: "Hello! I'd like to rent a car.",
  breadcrumbs: { aria: "Breadcrumbs", home: "Home" },
  home: {
    heroAlt: "Convertible on a mountain road in Georgia at sunset",
    whyUs: "Why choose us",
    carsFrom: (n, price) => `${n} ${enPlural(n, "car", "cars")} from ${price} per day`,
    noHidden: "No hidden fees",
    freeAirport: "Free delivery to Batumi Airport",
    support: "24/7 support on WhatsApp",
    reviewsBadge: (n) => `${n} Google ${enPlural(n, "review", "reviews")}`,
    popularTitle: "Popular cars",
    popularText: "Economy, SUVs, minivans and premium cars — we'll match a car to your route around Georgia.",
    seeAllCars: (n) => `See all ${n} ${enPlural(n, "car", "cars")}`,
    sightsTitle: (city) => `Where to go from ${city}`,
    sightsText: "The coast, mountains, canyons and waterfalls of Adjara — places that are easy to reach by rental car.",
    seeAllSights: (n) => `See all ${n} ${enPlural(n, "place", "places")}`,
    reviewsTitle: "Customer reviews",
    reviewsEmpty: "We'd love to hear your feedback on Google.",
    allReviews: "All reviews on Google ↗",
    leaveReview: "Leave a review",
    aboutTitle: "Why choose us",
    aboutLead: "Support, honest prices and delivery wherever suits you.",
    reasons: [
      ["24/7 support", "Always reachable by phone and messengers. We help you pick a car, suggest a route and sort out any question on the road."],
      ["Honest price", "The daily rate depends only on the rental length and is shown upfront. No hidden fees or extra charges at pick-up."],
      ["Delivery where you need it", "We bring the car to the airport, your hotel or any place in Batumi — and pick it up there too."],
    ],
    writeWhatsapp: "Message us on WhatsApp",
    writeTelegram: "Message us on Telegram",
    jsonLdRegion: "Adjara",
    jsonLdCountry: "Georgia",
  },
  how: {
    title: "How it works",
    lead: "Pick the perfect vehicle, fill out a quick form, and leave the rest to us. We'll confirm your booking and get you on the road in no time.",
    steps: [
      ["Choose a car", "Explore our range of vehicles and pick the one that matches your journey."],
      ["Fill out the form", "Enter your booking details and preferences."],
      ["Wait for a call", "Sit back and relax! Our team will get in touch shortly to confirm your booking."],
    ],
  },
  booking: {
    title: "Booking request",
    name: "Your name",
    phone: "Phone / WhatsApp",
    comment: "Comment (optional)",
    commentPlaceholder: "Pick-up time, child seat…",
    pickup: "Where will you pick up the car",
    pickupFee: "Delivery",
    free: "free",
    submit: "Send request",
    sending: "Sending…",
    or: "or",
    done: "Thank you! Your request has been sent — we'll contact you shortly to confirm the booking.",
    errors: {
      car: "This car is not available for booking right now.",
      name: "Please enter your name.",
      phone: "Please enter a phone number with the country code.",
      dates: "Please choose pick-up and return dates (not in the past).",
      busy: "This car is already booked for these dates — please choose other dates or another car.",
      comment: "The comment is too long.",
      pickup: "Please choose where you will pick up the car.",
    },
  },
  search: { aria: "Car search", from: "Pick-up date", to: "Return date", type: "Car type", any: "Any", submit: "Find a car", calendar: "Rental dates calendar", done: "Done", clear: "Clear", hintFrom: "Select a pick-up date", hintTo: "Now select a return date" },
  catalog: {
    title: (city) => `Car rental in ${city}`,
    metaDescription: (site) => `All ${site} cars: economy, SUVs, minivans and premium. Prices by rental length, airport delivery.`,
    lead: "Click a car to see photos, specifications and prices by rental length.",
    period: "Rental dates",
    pricesForPeriod: "Prices are for the whole rental.",
    resetDates: "Clear dates",
    filter: "Filter",
    all: "All",
    free: "Available",
  },
  card: { from: "from", perDay: "/ day", total: (n) => `for ${n} ${enPlural(n, "day", "days")}`, more: "Details →", busy: "Booked for these dates", seats: (n) => `${n} ${enPlural(n, "seat", "seats")}`, rentIn: (name, city) => `${name} for rent in ${city}` },
  days: (n) => `${n} ${enPlural(n, "day", "days")}`,
  tiers: { "1-3": "1–3 days", "4-7": "4–7 days", "8-30": "8–30 days", "31+": "31+ days" },
  car: {
    metaTitle: (name, city, price) => `${name} rental in ${city} — from ${price}/day`,
    notFound: "Car not found",
    loading: "Loading…",
    rentIn: (city) => `For rent in ${city}`,
    photo: (name, n) => `${name} — photo ${n}`,
    description: "Description",
    specs: (name) => `${name} specifications`,
    features: "Features",
    perDayByTerm: "Price per day by rental length",
    deposit: "Deposit",
    minTerm: "Minimum rental",
    book: "Message on WhatsApp",
    bookTelegram: "Message on Telegram",
    call: "Call",
    whatsapp: (name, url) => `Hello! I'd like to rent the ${name}. ${url}`,
    labels: {
      year: "Year", category: "Class", transmission: "Transmission",
      fuel: "Fuel", engine: "Engine", drive: "Drive", seats: "Seats", doors: "Doors", luggage: "Suitcases", color: "Color",
    },
  },
  sights: {
    title: (city) => `Road trips from ${city}`,
    metaDescription: "The coast, mountains, canyons and waterfalls of Adjara and Samegrelo: road-trip destinations by rental car, each pinned on Google Maps.",
    lead: "Our hand-picked list of places in Adjara and nearby: the coast, mountains, canyons and waterfalls — with photos, a description and a Google Maps pin.",
    maps: "Map ↗",
    crumb: "Where to go",
  },
  sight: {
    metaTitle: (name, city) => `${name} — a road trip from ${city}`,
    notFound: "Place not found",
    photo: (name, n) => `${name} — photo ${n}`,
    about: "About the place",
    region: "Region",
    route: "Area",
    howToGet: "Getting there",
    howToGetText: (city) => `From ${city}, the easiest way to get there is by car. On the map:`,
    rentCar: "Choose a car",
    car: "Recommended car",
    distance: "From central Batumi",
    km: (km) => `${km} km`,
    fromBatumi: (km) => `${km} km from Batumi`,
    time: (min) => (min < 60 ? `~${min} min` : `~${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`),
  },
  legal: {
    privacyDescription: "How AvtoNik collects, uses and stores personal data when you book a rental car in Batumi.",
    termsDescription: "AvtoNik car rental terms in Batumi: driver requirements, deposit, rental period, insurance and cancellation.",
  },
  notFound: { title: "Page not found", text: "The car may no longer be available for rent.", home: "Back to home" },
};

export const DICTS: Record<Lang, Dict> = { en, ru };
export const t = (lang: Lang) => DICTS[lang];

// Короткие значения из админки (кузов, привод), которые вводятся по-русски: перевод для английской версии.
const VALUE_EN: Record<string, string> = {
  "Кроссовер": "Crossover", "Седан": "Sedan", "Минивэн": "Minivan", "Хэтчбек": "Hatchback", "Хетчбэк": "Hatchback", "Хетчбек": "Hatchback", "Внедорожник": "SUV",
  "Универсал": "Station wagon", "Купе": "Coupe", "Кабриолет": "Convertible", "Пикап": "Pickup", "Лифтбек": "Liftback",
  "Полный (AWD)": "All-wheel drive (AWD)", "Полный (4WD)": "Four-wheel drive (4WD)", "Полный": "All-wheel drive",
  "Передний (FWD)": "Front-wheel drive (FWD)", "Передний": "Front-wheel drive", "Задний (RWD)": "Rear-wheel drive (RWD)", "Задний": "Rear-wheel drive",
};
export const valueIn = (lang: Lang, v: string) => (lang === "en" ? (VALUE_EN[v.trim()] ?? v) : v);

/** Язык из params страницы ([lang] уже проверен в корневом layout). */
export async function langFrom(params: Promise<{ lang: string }>): Promise<Lang> {
  const { lang } = await params;
  return isLang(lang) ? lang : DEFAULT_LANG;
}
