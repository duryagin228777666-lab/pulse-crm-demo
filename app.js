// Pulse CRM — демо-приложение без сервера (данные в localStorage)
let state = loadState();
const ui = { view: 'dashboard', selectedId: null, day: startOfDay(new Date()), query: '', inboxFilter: 'all', clientsSort: 'spent' };
const $ = (sel) => document.querySelector(sel);
const TITLES = { dashboard: 'Дашборд', schedule: 'Расписание', inbox: 'Необработанные заявки', clients: 'Клиенты', settings: 'Настройки' };
const AVATAR_COLORS = ['#5b5bf0', '#16a36a', '#e3940b', '#e0464b', '#2aa3e0', '#9b59d0', '#d0559b'];

// ---------- утилиты ----------
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function sameDay(a, b) { return startOfDay(a).getTime() === startOfDay(b).getTime(); }
function money(n) { return Number(n || 0).toLocaleString('ru-RU') + ' ₽'; }
function hhmm(d) { return new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); }
function dayLabel(d) { return new Date(d).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }); }
function whenLabel(iso) { if (!iso) return 'без времени'; const d = new Date(iso); return (sameDay(d, new Date()) ? 'сегодня' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })) + ' в ' + hhmm(d); }
function initials(name) { return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase(); }
function avatarColor(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]; }
function avatar(name) { return `<span class="avatar" style="background:${avatarColor(name)}">${esc(initials(name))}</span>`; }
function pill(status) { return `<span class="pill ${status}">${STATUS[status]}</span>`; }
function flags(b) { return `<span class="flags"><span class="flag ${b.called ? 'on' : ''}" title="Обзвон">☎</span><span class="flag ${b.reminded ? 'on' : ''}" title="Напоминание">✉</span></span>`; }
function byId(id) { return state.bookings.find((b) => b.id === id); }
function matches(b, q) { if (!q) return true; q = q.toLowerCase(); return [b.name, b.phone, b.car, b.code, b.service].some((f) => String(f).toLowerCase().includes(q)); }

function toast(text, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind; el.textContent = text;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), 3200);
}

// неизменяемое обновление записи + журнал
function updateBooking(id, patch, logText) {
  state = {
    ...state,
    bookings: state.bookings.map((b) => b.id !== id ? b : {
      ...b, ...patch,
      history: logText ? [...b.history, { at: new Date().toISOString(), text: logText }] : b.history
    })
  };
  saveState(state); render();
}

// ---------- рендер ----------
function render() {
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === ui.view));
  $('#viewTitle').textContent = TITLES[ui.view];
  $('#inboxCount').textContent = state.bookings.filter((b) => !b.visitAt && b.status !== 'cancelled').length;
  const views = { dashboard: renderDashboard, schedule: renderSchedule, inbox: renderInbox, clients: renderClients, settings: renderSettings };
  $('#view').innerHTML = views[ui.view]();
  bindView();
  renderDetails();
}

function renderDashboard() {
  const now = new Date();
  const active = state.bookings.filter((b) => b.status !== 'cancelled');
  const today = active.filter((b) => b.visitAt && sameDay(b.visitAt, now)).sort((a, b) => a.visitAt.localeCompare(b.visitAt));
  const revenueIn = (from, to) => state.bookings.filter((b) => b.status === 'done' && b.visitAt && new Date(b.visitAt) >= from && new Date(b.visitAt) < to).reduce((s, b) => s + b.price, 0);
  const d0 = startOfDay(now), w1 = new Date(d0), w2 = new Date(d0);
  w1.setDate(w1.getDate() - 7); w2.setDate(w2.getDate() - 14);
  const rev = revenueIn(w1, d0), revPrev = revenueIn(w2, w1);
  const delta = revPrev ? Math.round((rev / revPrev - 1) * 100) : 0;
  const unsched = active.filter((b) => !b.visitAt).length;
  const upcoming = active.filter((b) => b.visitAt && new Date(b.visitAt) >= now);
  const calledPct = upcoming.length ? Math.round(upcoming.filter((b) => b.called).length / upcoming.length * 100) : 100;
  const cancelled = state.bookings.filter((b) => b.status === 'cancelled').length;

  // выручка по дням (14 дней)
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(d0); d.setDate(d.getDate() - 13 + i); return d; });
  const vals = days.map((d) => { const e = new Date(d); e.setDate(e.getDate() + 1); return revenueIn(d, e); });
  const max = Math.max(...vals, 1), W = 700, H = 200, bw = W / 14;
  const bars = vals.map((v, i) => {
    const h = Math.max(2, v / max * (H - 30));
    return `<rect class="bar" x="${i * bw + 6}" y="${H - 18 - h}" width="${bw - 12}" height="${h}" rx="4"><title>${days[i].toLocaleDateString('ru-RU')}: ${money(v)}</title></rect>
      <text x="${i * bw + bw / 2}" y="${H - 4}" text-anchor="middle">${days[i].getDate()}</text>`;
  }).join('');

  const srcCounts = SOURCES.map((s) => state.bookings.filter((b) => b.source === s).length);
  const srcTotal = srcCounts.reduce((a, b) => a + b, 0) || 1;

  return `
  <div class="grid kpis">
    <div class="card kpi"><div class="label">Записей сегодня</div><div class="value">${today.length}</div><div class="muted">${today.filter((b) => !b.called).length} ещё не обзвонены</div></div>
    <div class="card kpi"><div class="label">Выручка за 7 дней</div><div class="value">${money(rev)}</div><div class="delta ${delta < 0 ? 'neg' : ''}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% к прошлой неделе</div></div>
    <div class="card kpi"><div class="label">Необработанные заявки</div><div class="value">${unsched}</div><div class="muted">ждут назначения времени</div></div>
    <div class="card kpi"><div class="label">Обзвон предстоящих</div><div class="value">${calledPct}%</div><div class="muted">${cancelled} отмен за всё время</div></div>
  </div>
  <div class="grid two">
    <div class="card chart"><h3>Выручка по дням, 14 дней</h3><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${bars}</svg></div>
    <div class="card"><h3>Источники заявок</h3>
      ${SOURCES.map((s, i) => `<div class="legend-row"><span class="dot" style="background:${SOURCE_COLORS[i]}"></span><span style="width:84px">${s}</span>
        <span class="meter"><b style="width:${srcCounts[i] / srcTotal * 100}%;background:${SOURCE_COLORS[i]}"></b></span><b>${srcCounts[i]}</b></div>`).join('')}
    </div>
  </div>
  <div class="grid two">
    <div class="card"><h3>Сегодня по расписанию</h3>
      ${today.length ? today.map((b) => `<div class="list-row" data-open="${b.id}"><span class="time">${hhmm(b.visitAt)}</span>${avatar(b.name)}
        <div class="grow"><b>${esc(b.name)}</b><div class="muted">${esc(b.service)} · ${esc(b.car)}</div></div>${flags(b)}${pill(b.status)}</div>`).join('') : '<div class="empty">На сегодня записей нет</div>'}
    </div>
    <div class="card"><h3>Требуют внимания</h3>
      ${active.filter((b) => !b.visitAt || (!b.called && b.visitAt && new Date(b.visitAt) > now)).slice(0, 7).map((b) => `<div class="list-row" data-open="${b.id}">${avatar(b.name)}
        <div class="grow"><b>${esc(b.name)}</b><div class="muted">${b.visitAt ? 'не обзвонен · ' + whenLabel(b.visitAt) : 'нет времени · ' + esc(b.source)}</div></div></div>`).join('') || '<div class="empty">Всё обработано 🎉</div>'}
    </div>
  </div>`;
}

function renderSchedule() {
  const s = state.settings, now = new Date();
  const dayItems = state.bookings.filter((b) => b.visitAt && sameDay(b.visitAt, ui.day) && matches(b, ui.query));
  const slots = [];
  for (let m = s.dayStart * 60; m < s.dayEnd * 60; m += s.slotMin) slots.push(m);
  const rows = slots.map((m) => {
    const start = new Date(ui.day); start.setHours(0, m, 0, 0);
    const end = new Date(start.getTime() + s.slotMin * 60000);
    const inSlot = dayItems.filter((b) => { const t = new Date(b.visitAt); return t >= start && t < end; });
    const cls = now >= start && now < end ? 'now' : end <= now ? 'past' : '';
    return `<div class="slot ${cls}" data-slot="${start.toISOString()}"><div class="t">${hhmm(start)}${inSlot.length > 1 ? `<div class="muted">×${inSlot.length}</div>` : ''}</div>
      <div class="cell">${inSlot.map(chip).join('')}</div></div>`;
  }).join('');
  const unsched = state.bookings.filter((b) => !b.visitAt && b.status !== 'cancelled' && matches(b, ui.query));
  const total = dayItems.filter((b) => b.status !== 'cancelled').reduce((a, b) => a + b.price, 0);
  return `
  <div class="sched-head">
    <button class="btn" data-day="-1">←</button><button class="btn" data-day="0">Сегодня</button><button class="btn" data-day="1">→</button>
    <h2>${dayLabel(ui.day)}</h2>
    <span class="muted">${dayItems.length} записей · план ${money(total)}</span>
  </div>
  <div class="sched-wrap">
    <div class="day-grid">${rows}</div>
    <div class="card unsched"><h3>Без времени (${unsched.length})</h3>
      ${unsched.map(chip).join('') || '<div class="muted">Все заявки распределены</div>'}
      <div class="drop-zone" data-unslot>Перетащите сюда, чтобы снять время</div>
      <p class="muted">Перетаскивайте карточки в слоты. В одном слоте может быть несколько клиентов.</p>
    </div>
  </div>`;
}

function chip(b) {
  return `<div class="chip ${b.status} ${b.id === ui.selectedId ? 'sel' : ''}" draggable="true" data-id="${b.id}">
    <div class="top"><span>${esc(b.name)}</span>${flags(b)}</div>
    <div class="sub">${b.visitAt ? hhmm(b.visitAt) + ' · ' : ''}${esc(b.service)}</div>
    <div class="sub">${esc(b.car)} · ${money(b.price)}</div></div>`;
}

function renderInbox() {
  const f = ui.inboxFilter;
  const list = state.bookings
    .filter((b) => !b.visitAt && b.status !== 'cancelled' && matches(b, ui.query))
    .filter((b) => f === 'all' || (f === 'notcalled' ? !b.called : b.source === f))
    .sort((a, b) => b.history[0].at.localeCompare(a.history[0].at));
  const segs = [['all', 'Все'], ['notcalled', 'Не обзвонены'], ['Сайт', 'С сайта'], ['Telegram', 'Telegram']];
  return `<div class="filters"><div class="seg">${segs.map(([k, l]) => `<button data-filter="${k}" class="${f === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
  ${list.length ? `<table><thead><tr><th>Клиент</th><th>Услуга</th><th>Источник</th><th>Поступила</th><th>Статус</th><th></th></tr></thead><tbody>
  ${list.map((b) => `<tr data-open="${b.id}" class="${b.id === ui.selectedId ? 'sel' : ''}"><td><div class="who">${avatar(b.name)}<div><b>${esc(b.name)}</b><div class="muted">${esc(b.phone)}</div></div></div></td>
    <td>${esc(b.service)}<div class="muted">${esc(b.car)}</div></td><td>${esc(b.source)}</td><td class="muted">${new Date(b.history[0].at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
    <td>${flags(b)}</td><td><button class="btn sm" data-assign="${b.id}">Назначить время</button></td></tr>`).join('')}
  </tbody></table>` : '<div class="card empty">Необработанных заявок нет 🎉</div>'}`;
}

function clientList() {
  const map = new Map();
  state.bookings.forEach((b) => {
    const c = map.get(b.phone) || { name: b.name, phone: b.phone, cars: new Set(), visits: 0, spent: 0, last: null, ids: [] };
    c.cars.add(b.car); c.ids.push(b.id);
    if (b.status === 'done') { c.visits++; c.spent += b.price; if (!c.last || b.visitAt > c.last) c.last = b.visitAt; }
    map.set(b.phone, c);
  });
  return [...map.values()];
}

function renderClients() {
  const sorters = { spent: (a, b) => b.spent - a.spent, visits: (a, b) => b.visits - a.visits, name: (a, b) => a.name.localeCompare(b.name) };
  const list = clientList().filter((c) => matches({ name: c.name, phone: c.phone, car: [...c.cars].join(' '), code: '', service: '' }, ui.query)).sort(sorters[ui.clientsSort]);
  const segs = [['spent', 'По выручке'], ['visits', 'По визитам'], ['name', 'По имени']];
  return `<div class="filters"><div class="seg">${segs.map(([k, l]) => `<button data-sort="${k}" class="${ui.clientsSort === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <span class="muted" style="align-self:center">${list.length} клиентов</span></div>
  <table><thead><tr><th>Клиент</th><th>Автомобиль</th><th>Визитов</th><th>Принёс</th><th>Последний визит</th><th></th></tr></thead><tbody>
  ${list.map((c) => `<tr data-open="${c.ids[c.ids.length - 1]}"><td><div class="who">${avatar(c.name)}<div><b>${esc(c.name)}</b><div class="muted">${esc(c.phone)}</div></div></div></td>
    <td>${esc([...c.cars].join(', '))}</td><td>${c.visits}</td><td><b>${money(c.spent)}</b></td><td class="muted">${c.last ? new Date(c.last).toLocaleDateString('ru-RU') : '—'}</td>
    <td>${c.visits >= 3 ? '<span class="pill confirmed">VIP</span>' : ''}</td></tr>`).join('')}
  </tbody></table>`;
}

function renderSettings() {
  const s = state.settings;
  const num = (k, label, min, max) => `<label class="field">${label}<input type="number" data-set="${k}" value="${s[k]}" min="${min}" max="${max}"></label>`;
  return `<div class="settings">
  <div class="card"><h3>Рабочий день</h3><div class="form">
    ${num('dayStart', 'Начало, час', 0, 23)}${num('dayEnd', 'Конец, час', 1, 24)}
    <label class="field">Длина слота<select data-set="slotMin">${[15, 20, 30, 60].map((v) => `<option ${s.slotMin === v ? 'selected' : ''} value="${v}">${v} мин</option>`).join('')}</select></label>
  </div></div>
  <div class="card"><h3>Напоминания</h3><div class="form">
    ${num('remindHours', 'За сколько часов до визита', 1, 48)}
    <label class="field">Канал<select data-set="channel">${['Telegram', 'WhatsApp', 'SMS'].map((v) => `<option ${s.channel === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
  </div><p class="muted">CRM проверяет предстоящие визиты каждую минуту и автоматически отправляет напоминание.</p></div>
  <div class="card"><h3>Услуги и прайс</h3>
    <div class="svc-row muted"><span>Название</span><span>Цена, ₽</span><span>Мин</span><span></span></div>
    ${s.services.map((v, i) => `<div class="svc-row"><input data-svc="${i}" data-k="name" value="${esc(v.name)}"><input type="number" data-svc="${i}" data-k="price" value="${v.price}">
      <input type="number" data-svc="${i}" data-k="duration" value="${v.duration}"><button class="x" data-delsvc="${i}" title="Удалить">×</button></div>`).join('')}
    <button class="btn sm" id="addSvc">+ Добавить услугу</button></div>
  <div class="card"><h3>Данные</h3><div class="actions">
    <button class="btn" id="exportBtn">⬇ Экспорт CSV</button>
    <button class="btn danger" id="resetBtn">↺ Сбросить к демо-данным</button></div>
    <p class="muted">Все данные хранятся локально в браузере.</p></div>
  </div>`;
}

function renderDetails() {
  const el = $('#details'), b = byId(ui.selectedId);
  el.classList.toggle('open', !!b);
  if (!b) { el.innerHTML = ''; return; }
  const visits = state.bookings.filter((x) => x.phone === b.phone && x.status === 'done');
  el.innerHTML = `<div class="details-in">
    <div class="details-head"><div class="who">${avatar(b.name)}<div><h2>${esc(b.name)}</h2><span class="muted">${esc(b.code)} · ${esc(b.source)}</span></div></div>
      <button class="x" data-close title="Закрыть (Esc)">×</button></div>
    <dl>
      <div><dt>Статус</dt><dd><select class="btn sm" data-status>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${b.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></dd></div>
      <div><dt>Телефон</dt><dd><a href="tel:${esc(b.phone.replace(/[^\d+]/g, ''))}">${esc(b.phone)}</a></dd></div>
      <div><dt>Визит</dt><dd>${b.visitAt ? `${dayLabel(b.visitAt)}, ${hhmm(b.visitAt)}` : '<span class="pill new">Без времени</span>'}</dd></div>
      <div><dt>Услуга</dt><dd>${esc(b.service)}<div class="muted">${b.duration} мин · ${money(b.price)}</div></dd></div>
      <div><dt>Автомобиль</dt><dd>${esc(b.car)}</dd></div>
      ${b.note ? `<div><dt>Заметка</dt><dd>${esc(b.note)}</dd></div>` : ''}
      <div><dt>История</dt><dd>${visits.length} визитов · ${money(visits.reduce((a, x) => a + x.price, 0))}</dd></div>
    </dl>
    <div class="toggles">
      <button class="toggle ${b.called ? 'on' : ''}" data-toggle="called">☎ ${b.called ? 'Обзвонен' : 'Не обзвонен'} <kbd>C</kbd></button>
      <button class="toggle ${b.reminded ? 'on' : ''}" data-toggle="reminded">✉ ${b.reminded ? 'Напомнили' : 'Не напомнили'} <kbd>S</kbd></button>
    </div>
    <div class="actions">
      <button class="btn" data-act="edit">✎ Изменить</button>
      <button class="btn" data-act="msg">💬 Написать <kbd>M</kbd></button>
      ${b.visitAt ? '<button class="btn" data-act="unslot">Снять время</button>' : '<button class="btn" data-act="edit">Назначить время</button>'}
      <button class="btn danger" data-act="del">🗑 Удалить</button>
    </div>
    <div class="timeline"><h4>Журнал</h4>${[...b.history].reverse().map((h) => `<div class="ev">${esc(h.text)}<div class="muted">${new Date(h.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div></div>`).join('')}</div>
  </div>`;
}

// ---------- обработчики вида ----------
function bindView() {
  const view = $('#view');
  view.querySelectorAll('[data-open]').forEach((el) => el.addEventListener('click', (e) => { if (e.target.closest('[data-assign]')) return; select(el.dataset.open); }));
  view.querySelectorAll('[data-assign]').forEach((el) => el.addEventListener('click', () => openForm(byId(el.dataset.assign))));
  view.querySelectorAll('[data-filter]').forEach((el) => el.addEventListener('click', () => { ui.inboxFilter = el.dataset.filter; render(); }));
  view.querySelectorAll('[data-sort]').forEach((el) => el.addEventListener('click', () => { ui.clientsSort = el.dataset.sort; render(); }));
  view.querySelectorAll('[data-day]').forEach((el) => el.addEventListener('click', () => {
    const d = Number(el.dataset.day);
    ui.day = d === 0 ? startOfDay(new Date()) : new Date(ui.day.getFullYear(), ui.day.getMonth(), ui.day.getDate() + d);
    render();
  }));
  bindDragDrop(view);
  bindSettings(view);
}

function bindDragDrop(view) {
  view.querySelectorAll('.chip').forEach((el) => {
    el.addEventListener('click', () => select(el.dataset.id));
    el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', el.dataset.id); el.classList.add('dragging'); });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
  });
  view.querySelectorAll('[data-slot], [data-unslot]').forEach((zone) => {
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault(); zone.classList.remove('over');
      const id = e.dataTransfer.getData('text/plain'), b = byId(id);
      if (!b) return;
      if (zone.dataset.unslot !== undefined) { updateBooking(id, { visitAt: null, reminded: false }, 'Время визита снято'); toast('Запись перенесена в «Без времени»'); return; }
      const iso = zone.dataset.slot;
      if (b.visitAt === iso) return;
      updateBooking(id, { visitAt: iso, reminded: false }, `Назначено на ${whenLabel(iso)}`);
      toast(`${b.name} → ${whenLabel(iso)}. Напоминание сброшено`);
    });
  });
}

function bindSettings(view) {
  const setSettings = (patch) => { state = { ...state, settings: { ...state.settings, ...patch } }; saveState(state); };
  view.querySelectorAll('[data-set]').forEach((el) => el.addEventListener('change', () => {
    const k = el.dataset.set, v = k === 'channel' ? el.value : Number(el.value);
    if (k === 'dayEnd' && v <= state.settings.dayStart) { toast('Конец дня должен быть позже начала', 'warn'); render(); return; }
    if (k === 'dayStart' && v >= state.settings.dayEnd) { toast('Начало дня должно быть раньше конца', 'warn'); render(); return; }
    setSettings({ [k]: v }); toast('Настройки сохранены');
  }));
  view.querySelectorAll('[data-svc]').forEach((el) => el.addEventListener('change', () => {
    const i = Number(el.dataset.svc), k = el.dataset.k;
    const services = state.settings.services.map((s, j) => j !== i ? s : { ...s, [k]: k === 'name' ? el.value.trim() : Math.max(0, Number(el.value)) });
    setSettings({ services }); toast('Прайс обновлён');
  }));
  view.querySelectorAll('[data-delsvc]').forEach((el) => el.addEventListener('click', () => {
    setSettings({ services: state.settings.services.filter((_, j) => j !== Number(el.dataset.delsvc)) }); render();
  }));
  $('#addSvc')?.addEventListener('click', () => { setSettings({ services: [...state.settings.services, { name: 'Новая услуга', price: 1000, duration: 30 }] }); render(); });
  $('#resetBtn')?.addEventListener('click', () => { if (confirm('Сбросить все данные к демонстрационным?')) { state = makeDemoData(); saveState(state); ui.selectedId = null; render(); toast('Демо-данные восстановлены'); } });
  $('#exportBtn')?.addEventListener('click', exportCsv);
}

function exportCsv() {
  const cols = ['code', 'name', 'phone', 'car', 'service', 'price', 'visitAt', 'status', 'source', 'called', 'reminded'];
  const rows = [cols.join(';'), ...state.bookings.map((b) => cols.map((c) => `"${String(b[c] ?? '').replace(/"/g, '""')}"`).join(';'))];
  const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'pulse-crm-export.csv' });
  a.click(); URL.revokeObjectURL(a.href);
}

// ---------- панель деталей ----------
function select(id) { ui.selectedId = id; render(); }

$('#details').addEventListener('click', (e) => {
  const b = byId(ui.selectedId); if (!b) return;
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.close !== undefined) { ui.selectedId = null; render(); }
  else if (t.dataset.toggle) toggleFlag(b, t.dataset.toggle);
  else if (t.dataset.act === 'edit') openForm(b);
  else if (t.dataset.act === 'msg') openMessage(b);
  else if (t.dataset.act === 'unslot') updateBooking(b.id, { visitAt: null, reminded: false }, 'Время визита снято');
  else if (t.dataset.act === 'del') deleteBooking(b);
});
$('#details').addEventListener('change', (e) => {
  const b = byId(ui.selectedId);
  if (b && e.target.dataset.status !== undefined) { updateBooking(b.id, { status: e.target.value }, `Статус: ${STATUS[e.target.value]}`); toast('Статус обновлён'); }
});

function toggleFlag(b, key) {
  const v = !b[key];
  const label = key === 'called' ? (v ? 'Клиент обзвонен' : 'Отметка обзвона снята') : (v ? 'Напоминание отмечено' : 'Отметка напоминания снята');
  updateBooking(b.id, { [key]: v }, label); toast(label);
}

function deleteBooking(b) {
  if (!confirm(`Удалить запись ${b.name} (${b.code}) без возможности восстановления?`)) return;
  state = { ...state, bookings: state.bookings.filter((x) => x.id !== b.id) };
  saveState(state); ui.selectedId = null; render(); toast('Запись удалена');
}

// ---------- модальные окна ----------
function closeModal() { $('#modal').hidden = true; }
$('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') closeModal(); });

function toLocalInput(iso) { if (!iso) return ['', '']; const d = new Date(iso); const p = (n) => String(n).padStart(2, '0'); return [`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, `${p(d.getHours())}:${p(d.getMinutes())}`]; }

function openForm(b = null) {
  const s = state.settings;
  const [date, time] = toLocalInput(b?.visitAt);
  const svcOpts = s.services.map((v) => `<option ${b?.service === v.name ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
  $('#modalBody').innerHTML = `<h2>${b ? 'Редактировать запись' : 'Новая запись'}</h2>
  <form class="form" id="bookingForm" novalidate>
    <label class="field">Имя клиента *<input name="name" value="${esc(b?.name)}" autofocus></label>
    <label class="field">Телефон *<input name="phone" value="${esc(b?.phone || '+7 ')}"></label>
    <label class="field">Автомобиль<input name="car" value="${esc(b?.car)}" placeholder="Kia Rio"></label>
    <label class="field">Источник<select name="source">${SOURCES.map((v) => `<option ${b?.source === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="field full">Услуга<select name="service">${svcOpts}</select></label>
    <label class="field">Дата визита<input type="date" name="date" value="${date}"></label>
    <label class="field">Время<input type="time" name="time" value="${time}" step="${s.slotMin * 60}"></label>
    <label class="field full">Заметка<textarea name="note" rows="2">${esc(b?.note)}</textarea></label>
    <div class="field full"><span class="err" id="formErr"></span></div>
  </form>
  <div class="modal-foot"><span class="muted" style="margin-right:auto">Без даты — попадёт в «Заявки»</span><button class="btn" data-cancel>Отмена</button><button class="primary" form="bookingForm">Сохранить</button></div>`;
  $('#modal').hidden = false;
  $('#modalBody [data-cancel]').onclick = closeModal;
  $('#modalBody [name=name]').focus();
  $('#bookingForm').onsubmit = (e) => { e.preventDefault(); saveForm(new FormData(e.target), b); };
}

function saveForm(fd, existing) {
  const name = fd.get('name').trim(), phone = fd.get('phone').trim();
  const err = $('#formErr');
  if (name.length < 2) { err.textContent = 'Укажите имя клиента'; return; }
  if (phone.replace(/\D/g, '').length < 11) { err.textContent = 'Телефон должен содержать 11 цифр'; return; }
  const date = fd.get('date'), time = fd.get('time');
  if (time && !date) { err.textContent = 'Укажите дату визита'; return; }
  const visitAt = date ? new Date(`${date}T${time || '10:00'}`).toISOString() : null;
  const svc = state.settings.services.find((v) => v.name === fd.get('service')) || { name: fd.get('service'), price: 0, duration: 30 };
  const data = { name, phone, car: fd.get('car').trim() || '—', source: fd.get('source'), service: svc.name, price: svc.price, duration: svc.duration, note: fd.get('note').trim(), visitAt };
  if (existing) {
    const moved = existing.visitAt !== visitAt;
    updateBooking(existing.id, { ...data, reminded: moved ? false : existing.reminded }, moved ? `Изменено, визит: ${whenLabel(visitAt)}` : 'Данные изменены');
    toast('Изменения сохранены');
  } else {
    const code = 'PL-' + (Math.max(1000, ...state.bookings.map((b) => Number(b.code.slice(3)) || 0)) + 1);
    const nb = { id: crypto.randomUUID(), code, ...data, status: 'new', called: false, reminded: false, history: [{ at: new Date().toISOString(), text: 'Заявка создана вручную' }] };
    state = { ...state, bookings: [...state.bookings, nb] }; saveState(state);
    ui.selectedId = nb.id;
    if (visitAt) { ui.view = 'schedule'; ui.day = startOfDay(visitAt); } else ui.view = 'inbox';
    render(); toast(`Запись ${code} создана`);
  }
  closeModal();
}

function fillTemplate(text, b) {
  return text.replace('{name}', b.name.split(' ')[0]).replace('{when}', whenLabel(b.visitAt)).replace('{service}', b.service).replace('{price}', b.price.toLocaleString('ru-RU'));
}

function openMessage(b) {
  const tpls = state.settings.templates;
  $('#modalBody').innerHTML = `<h2>Сообщение · ${esc(b.name)}</h2>
    <div class="tpls">${tpls.map((t, i) => `<button class="btn sm" data-tpl="${i}">${esc(t.label)}</button>`).join('')}</div>
    <div class="form">
      <label class="field">Канал<select id="msgCh">${['Telegram', 'WhatsApp', 'SMS'].map((v) => `<option ${state.settings.channel === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field">Получатель<input value="${esc(b.phone)}" disabled></label>
      <label class="field full">Текст<textarea id="msgText" rows="5">${esc(fillTemplate(tpls[0].text, b))}</textarea></label>
    </div>
    <div class="modal-foot"><button class="btn" data-cancel>Отмена</button><button class="primary" id="sendMsg">Отправить</button></div>`;
  $('#modal').hidden = false;
  $('#modalBody [data-cancel]').onclick = closeModal;
  $('#modalBody').querySelectorAll('[data-tpl]').forEach((el) => el.onclick = () => { $('#msgText').value = fillTemplate(tpls[Number(el.dataset.tpl)].text, b); });
  $('#sendMsg').onclick = () => {
    const text = $('#msgText').value.trim(), ch = $('#msgCh').value;
    if (!text) { toast('Сообщение пустое', 'warn'); return; }
    updateBooking(b.id, {}, `${ch}: «${text.length > 60 ? text.slice(0, 60) + '…' : text}»`);
    closeModal(); toast(`Отправлено в ${ch} (демо-режим)`);
  };
}

// ---------- автонапоминания (симуляция) ----------
function runReminders() {
  const now = Date.now(), win = state.settings.remindHours * 3600000;
  state.bookings.filter((b) => b.visitAt && !b.reminded && ['new', 'confirmed'].includes(b.status))
    .filter((b) => { const t = new Date(b.visitAt).getTime(); return t > now && t - now <= win; })
    .forEach((b) => { updateBooking(b.id, { reminded: true }, `Авто-напоминание отправлено (${state.settings.channel})`); toast(`🔔 Напоминание ушло: ${b.name}, ${hhmm(b.visitAt)}`); });
}

// ---------- глобальные события ----------
$('#nav').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { ui.view = b.dataset.view; render(); } });
$('#newBtn').addEventListener('click', () => openForm());
$('#search').addEventListener('input', (e) => {
  ui.query = e.target.value.trim();
  if (ui.query && ui.view === 'dashboard') ui.view = 'clients';
  render(); $('#search').focus();
});
$('#themeBtn').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : '';
  localStorage.setItem('pulse-theme', dark ? 'dark' : '');
});
document.documentElement.dataset.theme = localStorage.getItem('pulse-theme') || '';

document.addEventListener('keydown', (e) => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
  if (e.key === 'Escape') { if (!$('#modal').hidden) closeModal(); else { ui.selectedId = null; render(); } return; }
  if (typing || !$('#modal').hidden || e.ctrlKey || e.metaKey) return;
  const b = byId(ui.selectedId), k = e.key.toLowerCase();
  if (k === 'n' || k === 'т') { e.preventDefault(); openForm(); }
  else if (k === '/') { e.preventDefault(); $('#search').focus(); }
  else if (!b) return;
  else if (e.key === 'Enter') openForm(b);
  else if (k === 'c' || k === 'с') toggleFlag(b, 'called');
  else if (k === 's' || k === 'ы') toggleFlag(b, 'reminded');
  else if (k === 'm' || k === 'ь') openMessage(b);
  else if (e.key === 'Delete') deleteBooking(b);
});

// #schedule, #inbox, … открывают нужный раздел (удобно для ссылок и скриншотов)
function applyHash() {
  const [view, extra] = location.hash.slice(1).split('-');
  if (TITLES[view]) ui.view = view;
  if (extra === 'dark') document.documentElement.dataset.theme = 'dark';
  if (extra === 'card') ui.selectedId = state.bookings.find((b) => b.visitAt && sameDay(b.visitAt, new Date()))?.id ?? null;
}
window.addEventListener('hashchange', () => { applyHash(); render(); });
applyHash();
render();
runReminders();
setInterval(runReminders, 60000);
