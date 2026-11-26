// Хранилище и демо-данные (все имена и телефоны вымышленные)
const STORE_KEY = 'pulse-crm-v1';

const STATUS = { new: 'Новая', confirmed: 'Подтверждена', done: 'Выполнена', cancelled: 'Отменена' };
const SOURCES = ['Сайт', 'Звонок', 'Telegram', 'WhatsApp', 'Повторный'];
const SOURCE_COLORS = ['#5b5bf0', '#16a36a', '#2aa3e0', '#25c26e', '#e3940b'];

const DEFAULT_SETTINGS = {
  dayStart: 9, dayEnd: 21, slotMin: 30, remindHours: 3, channel: 'Telegram',
  services: [
    { name: 'Шиномонтаж R13–R16', price: 2400, duration: 40 },
    { name: 'Шиномонтаж R17–R20', price: 3600, duration: 60 },
    { name: 'Балансировка', price: 1200, duration: 30 },
    { name: 'Хранение шин (сезон)', price: 4000, duration: 15 },
    { name: 'Ремонт прокола', price: 900, duration: 30 },
    { name: 'Правка диска', price: 2800, duration: 60 }
  ],
  templates: [
    { label: 'Напоминание', text: '{name}, напоминаем о записи {when}. Ждём вас!' },
    { label: 'Подтверждение', text: '{name}, вы записаны на «{service}» {when}. Стоимость от {price} ₽.' },
    { label: 'Перенос', text: '{name}, к сожалению, нужно перенести визит. Когда вам удобно?' },
    { label: 'Отзыв', text: '{name}, спасибо, что выбрали нас! Будем рады отзыву 🙏' }
  ]
};

const FIRST = ['Алексей', 'Мария', 'Иван', 'Ольга', 'Дмитрий', 'Анна', 'Сергей', 'Екатерина', 'Павел', 'Наталья', 'Артём', 'Юлия', 'Никита', 'Ирина', 'Роман', 'Светлана', 'Кирилл', 'Виктория'];
const LAST = ['Смирнов', 'Кузнецова', 'Попов', 'Васильева', 'Соколов', 'Новикова', 'Морозов', 'Волкова', 'Лебедев', 'Козлова', 'Егоров', 'Павлова'];
const CARS = ['Kia Rio', 'Hyundai Solaris', 'Toyota Camry', 'VW Polo', 'Skoda Octavia', 'Lada Vesta', 'BMW X5', 'Mazda CX-5', 'Renault Duster', 'Haval Jolion', 'Geely Coolray'];
const NOTES = ['', '', 'Свои шины в багажнике', 'Просил позвонить за час', 'Секретки на дисках', 'Постоянный клиент', ''];

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

function makeDemoData() {
  const rnd = seededRandom(42);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const people = Array.from({ length: 26 }, (_, i) => {
    const first = pick(FIRST);
    const female = /а$|я$/.test(first);
    const last = pick(LAST).replace(/а$/, '') + (female ? 'а' : '');
    const phone = '+7 9' + String(10 + i * 3).padStart(2, '0') + ' ' + String(100 + Math.floor(rnd() * 899)) + '-' + String(10 + Math.floor(rnd() * 89)) + '-' + String(10 + Math.floor(rnd() * 89));
    return { name: `${first} ${last}`, phone, car: pick(CARS) };
  });
  const bookings = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let n = 1;
  const add = (dayOffset, hour, min, person, extra = {}) => {
    const svc = pick(DEFAULT_SETTINGS.services);
    let visitAt = null;
    if (hour !== null) { const d = new Date(today); d.setDate(d.getDate() + dayOffset); d.setHours(hour, min); visitAt = d.toISOString(); }
    const created = new Date(today); created.setDate(created.getDate() + Math.min(dayOffset, 0) - 1 - Math.floor(rnd() * 3)); created.setHours(8 + Math.floor(rnd() * 12));
    const past = dayOffset < 0;
    bookings.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()),
      code: 'PL-' + String(1000 + n++),
      ...person, service: svc.name, price: svc.price, duration: svc.duration,
      visitAt, status: past ? (rnd() < 0.88 ? 'done' : 'cancelled') : (rnd() < 0.6 ? 'confirmed' : 'new'),
      called: past || rnd() < 0.55, reminded: past || (dayOffset === 0 && rnd() < 0.6),
      source: pick(SOURCES), note: pick(NOTES),
      history: [{ at: created.toISOString(), text: 'Заявка создана' }],
      ...extra
    });
  };
  // прошлые 14 дней
  for (let d = -14; d < 0; d++) {
    const count = 3 + Math.floor(rnd() * 6);
    for (let k = 0; k < count; k++) add(d, 9 + Math.floor(rnd() * 11), rnd() < 0.5 ? 0 : 30, pick(people));
  }
  // сегодня — плотный день, в т.ч. 2–3 клиента в одном слоте
  [[9, 0], [9, 30], [10, 0], [10, 0], [10, 0], [11, 30], [12, 0], [13, 0], [14, 30], [14, 30], [16, 0], [17, 30], [18, 0], [19, 0]]
    .forEach(([h, m]) => add(0, h, m, pick(people)));
  // ближайшие дни
  for (let d = 1; d <= 6; d++) {
    const count = 2 + Math.floor(rnd() * 5);
    for (let k = 0; k < count; k++) add(d, 9 + Math.floor(rnd() * 11), rnd() < 0.5 ? 0 : 30, pick(people));
  }
  // необработанные заявки с сайта без времени
  for (let k = 0; k < 6; k++) add(0, null, 0, pick(people), { status: 'new', called: false, reminded: false, source: k % 2 ? 'Сайт' : 'Telegram' });
  return { bookings, settings: structuredClone(DEFAULT_SETTINGS) };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.bookings) && parsed.settings) return parsed;
    }
  } catch (err) {
    console.warn('Не удалось прочитать сохранённые данные, загружаю демо', err);
  }
  return makeDemoData();
}

function saveState(state) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (err) { console.error('Ошибка сохранения', err); }
}
