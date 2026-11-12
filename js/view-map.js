// Экран «Карта» — планирование: проекты, этапы, шаги.
(function () {
  const MP = window.MP;
  const { esc } = MP;
  const D = MP.D;

  let filter = 'all';
  const open = new Set();
  let newStepEnergy = 1;

  // ---- накопления: сумма, необязательная цель, отметки с датой ----
  const money = n => MP.fmt(n) + ' ' + MP.CURRENCY;
  const niceDate = d => new Date(d + 'T12:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

  function savingsBox(p, isOpen) {
    const sv = D.saved(p.id), t = p.savingsTarget || 0, deps = D.deposits(p.id);
    let h = '<div class="save-box"><div class="row"><div class="grow">🪙 <b>' + money(sv) + '</b> <span class="meta">' +
      (t ? 'из ' + money(t) + ' · ' + Math.min(100, Math.round((sv / t) * 100)) + '%' : 'отложено') + '</span></div>' +
      '<button class="btn small warm" data-act="newDeposit" data-id="' + p.id + '">+ Отложила</button></div>' +
      (t ? '<div class="bar"><div style="width:' + Math.min(100, (sv / t) * 100) + '%;background:var(--accent2)"></div></div>' : '') +
      '<button class="linkb" data-act="setTarget" data-id="' + p.id + '">' + (t ? 'изменить цель' : 'задать цель (необязательно)') + '</button>';
    if (isOpen && deps.length) {
      h += '<div class="deps">' + deps.map(d =>
        '<div class="dep"><span class="grow">' + niceDate(d.date) + ' · <b>' + money(d.amount) + '</b></span>' +
        '<button class="ic" aria-label="Исправить отметку" data-act="editDeposit" data-id="' + d.id + '">✎</button>' +
        '<button class="ic" aria-label="Удалить отметку" data-act="delDeposit" data-id="' + d.id + '">🗑</button></div>').join('') + '</div>';
    }
    return h + '</div>';
  }

  function depositForm(p, dep) {
    MP.openModal('<h3>🪙 Отложила на «' + esc(p.name) + '»</h3><form data-submit="saveDeposit" data-project="' + p.id + '" data-id="' + (dep ? dep.id : '') + '">' +
      '<label>Сумма, ' + MP.CURRENCY + '</label><input name="amount" type="number" inputmode="decimal" min="1" max="1000000000000" step="any" required placeholder="Сколько отложила" value="' + (dep ? dep.amount : '') + '">' +
      '<label>Дата</label><input name="date" type="date" required max="' + MP.today() + '" value="' + (dep ? dep.date : MP.today()) + '">' +
      buttons(dep ? 'Сохранить' : 'Добавить') + '</form>');
  }
  MP.acts.newDeposit = el => depositForm(D.project(el.dataset.id), null);
  MP.acts.editDeposit = el => {
    const dep = MP.Store.get('deposits', el.dataset.id);
    depositForm(D.project(dep.projectId), dep);
  };
  MP.acts.saveDeposit = form => {
    const amount = +form.elements.amount.value, date = form.elements.date.value;
    if (!(amount > 0) || !isFinite(amount) || !date) return;
    if (form.dataset.id) {
      D.updateDeposit(form.dataset.id, { amount, date });
      MP.closeModal(); MP.render(); MP.toast('Исправлено');
      return;
    }
    const r = D.addDeposit(form.dataset.project, amount, date);
    MP.closeModal(); MP.render(); MP.burst(r.pct === 100 ? 24 : 10);
    MP.toast(r.pct === 100 ? 'Цель накопления достигнута! 🏆' : r.pct ? 'Уже ' + r.pct + '% пути к цели! 🎉' : 'Ещё один шаг к цели 💛');
  };
  MP.acts.delDeposit = el => {
    const list = D.deleteDeposit(el.dataset.id);
    MP.render();
    MP.undoToast('Отметка удалена', list);
  };
  MP.acts.setTarget = el => {
    const p = D.project(el.dataset.id);
    MP.openModal('<h3>Цель накопления</h3><div class="hint">Необязательно. Её можно поменять или убрать в любой момент (оставь поле пустым).</div>' +
      '<form data-submit="saveTarget" data-id="' + p.id + '"><label>Сумма, ' + MP.CURRENCY + '</label>' +
      '<input name="target" type="number" inputmode="decimal" min="0" max="1000000000000" step="any" value="' + (p.savingsTarget || '') + '">' + buttons('Сохранить') + '</form>');
  };
  MP.acts.saveTarget = form => {
    const t = Math.max(0, +form.elements.target.value || 0);
    D.updateProject(form.dataset.id, { savingsTarget: t });
    MP.closeModal(); MP.render();
  };

  // ---- срок проекта: мягкий ориентир, без красного и штрафов ----
  const plural = (n, one, few, many) => { const m = n % 100, k = n % 10; return m > 10 && m < 15 ? many : k === 1 ? one : k >= 2 && k <= 4 ? few : many; };
  function dueLine(p) {
    const info = D.dueInfo(p);
    if (!info || p.status === 'done') return '';
    const far = info.left > 365;
    const ds = new Date(info.date + 'T12:00').toLocaleDateString('ru-RU', far ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long' }).replace(/\.$/, '').replace(/ г$/, '');
    const txt = info.left > 0 ? 'до ' + ds + (far ? '' : ' · осталось ' + info.left + ' ' + plural(info.left, 'день', 'дня', 'дней'))
      : info.left === 0 ? 'срок — сегодня (' + ds + ')' : 'срок был ' + ds;
    return '<div class="due"><span class="meta">🗓 ' + txt + '</span>' +
      (info.left <= 0 ? ' <button class="linkb" data-act="shiftDue" data-id="' + p.id + '">сдвинуть на неделю</button>' : '') + '</div>';
  }
  MP.acts.shiftDue = el => { D.shiftDue(el.dataset.id, 7); MP.render(); MP.toast('Срок сдвинут. Это ориентир, а не экзамен 💛'); };

  function projCard(p) {
    const pr = D.progress(p.id), n = D.nextStep(p.id), isOpen = open.has(p.id), stages = D.stages(p.id);
    let h = '<div class="card"><div class="proj-head" data-act="toggleProject" data-id="' + p.id + '" role="button" aria-expanded="' + isOpen + '">' +
      '<div class="grow"><b>' + D.sphere(p.sphereId).emoji + ' ' + esc(p.name) + '</b>' +
      '<div class="meta">' + stages.length + ' эт. · ' + pr + '%' + (n && !isOpen ? ' · дальше: ' + esc(n.step.text) : '') + '</div></div>' +
      '<span class="caret">' + (isOpen ? '▴' : '▾') + '</span></div>' +
      '<div class="bar"><div style="width:' + pr + '%"></div></div>' + dueLine(p);
    if (p.hasSavings) h += savingsBox(p, isOpen);

    if (isOpen) {
      stages.forEach(st => {
        const steps = D.steps(st.id), done = steps.filter(s => s.done).length, closed = D.stageDone(st.id);
        h += '<div class="stage ' + (closed ? 'closed' : '') + '"><div class="stage-title"><span>' + (closed ? '✅ ' : '') + esc(st.name) +
          ' <span class="meta">' + done + '/' + steps.length + '</span></span>' +
          '<span class="actions"><button class="ic" aria-label="Добавить шаг" data-act="newStep" data-id="' + st.id + '">＋</button>' +
          '<button class="ic" aria-label="Удалить этап" data-act="delStage" data-id="' + st.id + '">🗑</button></span></div>' +
          (steps.map(s => MP.stepRow(s, p, 'map')).join('') || '<div class="empty">Добавь первый шаг ＋</div>') + '</div>';
      });
      h += '<div class="row wrapr" style="margin-top:14px">' +
        '<button class="btn small ghost" data-act="newStage" data-id="' + p.id + '">+ Этап</button>' +
        (p.status === 'queue' ? '<button class="btn small" data-act="setStatus" data-id="' + p.id + '" data-v="active">▶ Взять в работу</button>' : '') +
        (p.status === 'active' ? '<button class="btn small ghost" data-act="setStatus" data-id="' + p.id + '" data-v="queue">⏳ В очередь</button>' : '') +
        (p.status === 'done' ? '<button class="btn small ghost" data-act="setStatus" data-id="' + p.id + '" data-v="queue">↺ Вернуть</button>' : '') +
        '<button class="btn small ghost" aria-label="Изменить проект" data-act="editProject" data-id="' + p.id + '">✎</button>' +
        '<button class="btn small ghost" aria-label="Удалить проект" data-act="delProject" data-id="' + p.id + '">🗑</button></div>';
    }
    return h + '</div>';
  }

  // Сворачиваемая сводка по сферам. У пустых сфер ничего не пишем: пусто — это не упрёк.
  let summaryOpen = false;
  function sphereSummary() {
    const all = D.projects();
    const rows = D.spheres().map(s => {
      const mine = all.filter(p => p.sphereId === s.id);
      const parts = [
        [mine.filter(p => p.status === 'active').length, 'в работе'],
        [mine.filter(p => p.status === 'queue').length, 'ждут'],
        [mine.filter(p => p.status === 'done').length, 'завершено']
      ].filter(x => x[0]).map(x => x[0] + ' ' + x[1]);
      return '<button class="sphere-row" data-act="setFilter" data-v="' + s.id + '"><span>' + s.emoji + ' ' + esc(s.name) + '</span><span class="meta">' + parts.join(' · ') + '</span></button>';
    }).join('');
    return '<div class="card summary"><button class="summary-head" data-act="toggleSummary" aria-expanded="' + summaryOpen + '"><b>Сводка по сферам</b><span class="caret">' + (summaryOpen ? '▴' : '▾') + '</span></button>' +
      (summaryOpen ? '<div class="summary-body">' + rows + '</div>' : '') + '</div>';
  }
  MP.acts.toggleSummary = () => { summaryOpen = !summaryOpen; MP.render(); };

  MP.views.map = function () {
    const act = D.projects('active'), q = D.projects('queue'), dn = D.projects('done');
    const f = p => filter === 'all' || p.sphereId === filter;
    const chips = [{ id: 'all', name: 'Все', emoji: '' }, ...D.spheres()];
    let h = '<div class="proj-head"><h1>🗺️ Карта</h1><button class="btn small" data-act="newProject">+ Проект</button></div>' +
      '<div class="sub" style="margin-bottom:12px">Здесь планируем и примеряем. Делаем — на «Сегодня».</div>' +
      sphereSummary() +
      '<div>' + chips.map(s => '<button class="chip ' + (filter === s.id ? 'on' : '') + '" data-act="setFilter" data-v="' + s.id + '">' + (s.emoji ? s.emoji + ' ' : '') + esc(s.name) + '</button>').join('') + '</div>';
    h += '<h2>В работе · ' + act.length + '/' + D.MAX_ACTIVE + '</h2>' + (act.filter(f).map(projCard).join('') || '<div class="empty">Пока пусто</div>');
    h += '<details ' + (q.filter(f).length ? 'open' : '') + '><summary><h2>⏳ Ждут своей очереди · ' + q.length + ' ▾</h2></summary>' + (q.filter(f).map(projCard).join('') || '<div class="empty">Пусто</div>') + '</details>';
    if (dn.length) h += '<details><summary><h2>🏆 Завершённые · ' + dn.length + ' ▾</h2></summary>' + dn.filter(f).map(projCard).join('') + '</details>';
    return h;
  };

  const val = (form, name) => form.elements[name].value.trim();
  const buttons = (okLabel) =>
    '<div class="row" style="margin-top:18px"><button type="button" class="btn ghost grow" data-act="closeModal">Отмена</button><button type="submit" class="btn grow">' + okLabel + '</button></div>';

  MP.acts.setFilter = el => { filter = el.dataset.v; MP.render(); };
  MP.acts.toggleProject = el => { const id = el.dataset.id; open.has(id) ? open.delete(id) : open.add(id); MP.render(); };

  MP.acts.setStatus = el => {
    const r = D.setStatus(el.dataset.id, el.dataset.v);
    if (!r.ok) return MP.toast('В работе уже ' + D.MAX_ACTIVE + ' проекта. Отправь один в очередь — это не отказ, а «не сейчас»');
    MP.render();
  };

  // ---- проект ----
  function projectForm(p) {
    MP.openModal('<h3>' + (p ? 'Проект' : 'Новый проект') + '</h3><form data-submit="saveProject" data-id="' + (p ? p.id : '') + '">' +
      '<label>Название</label><input name="name" required maxlength="80" placeholder="Например: Мой сайт" value="' + esc(p ? p.name : '') + '">' +
      '<label>Сфера</label>' + MP.sphereSelect(p ? p.sphereId : 'mine').replace('id="f-sph"', 'name="sphere"') +
      '<label>Срок (необязательно)</label><input name="due" type="date" value="' + esc(p && p.dueDate ? p.dueDate : '') + '">' +
      '<div class="meta">Мягкий ориентир: пройдёт — ничего не случится, дату можно сдвинуть.</div>' +
      '<label class="switch"><input type="checkbox" name="savings" data-act="toggleSavFields"' + (p && p.hasSavings ? ' checked' : '') + '> <span>С накоплением (копилка)</span></label>' +
      '<div id="sav-fields" style="' + (p && p.hasSavings ? '' : 'display:none') + '"><label>Цель, ' + MP.CURRENCY + ' (необязательно)</label>' +
      '<input name="target" type="number" inputmode="decimal" min="0" max="1000000000000" step="any" value="' + (p && p.savingsTarget ? p.savingsTarget : '') + '"></div>' +
      buttons(p ? 'Сохранить' : 'Создать') + '</form>');
  }
  MP.acts.toggleSavFields = el => { MP.$('#sav-fields').style.display = el.checked ? '' : 'none'; };
  MP.acts.newProject = () => projectForm(null);
  MP.acts.editProject = el => projectForm(D.project(el.dataset.id));
  MP.acts.saveProject = form => {
    const name = val(form, 'name');
    if (!name) return;
    const id = form.dataset.id;
    const sav = { hasSavings: form.elements.savings.checked, savingsTarget: Math.max(0, +form.elements.target.value || 0), dueDate: form.elements.due.value || null };
    if (id) D.updateProject(id, Object.assign({ name, sphereId: form.elements.sphere.value }, sav));
    else {
      const p = D.addProject({ name, sphereId: form.elements.sphere.value });
      D.updateProject(p.id, sav);
      open.add(p.id);
      if (p.status === 'queue') MP.toast('Проект в очереди — в работе уже ' + D.MAX_ACTIVE);
    }
    MP.closeModal();
    MP.render();
  };
  MP.acts.delProject = el => {
    const id = el.dataset.id;
    MP.confirmBox('Убрать проект целиком? Победы останутся в журнале.', () => {
      const list = D.deleteProject(id);
      MP.render();
      MP.undoToast('Проект убран', list);
    }, 'Убрать');
  };

  // ---- этап ----
  MP.acts.newStage = el => {
    MP.openModal('<h3>Новый этап</h3><form data-submit="saveStage" data-id="' + el.dataset.id + '"><label>Название этапа</label>' +
      '<input name="name" required maxlength="80" placeholder="Например: Структура и тексты">' + buttons('Добавить') + '</form>');
  };
  MP.acts.saveStage = form => {
    const name = val(form, 'name');
    if (!name) return;
    D.addStage(form.dataset.id, name);
    MP.closeModal();
    MP.render();
  };
  MP.acts.delStage = el => {
    const list = D.deleteStage(el.dataset.id);
    MP.render();
    MP.undoToast('Этап убран', list);
  };

  // ---- шаг ----
  MP.acts.newStep = el => {
    newStepEnergy = 1;
    MP.openModal('<h3>Новый шаг</h3>' +
      '<div class="hint">Хороший шаг начинается с глагола, занимает до 25 минут и понятен без раздумий.</div>' +
      '<form data-submit="saveStep" data-id="' + el.dataset.id + '">' +
      '<label>Что сделать</label><input name="text" required maxlength="200" placeholder="Например: Выбрать 3 сайта-примера">' +
      '<label>Сколько минут</label><input name="minutes" type="number" inputmode="numeric" value="15" min="1" max="600">' +
      '<label>Сколько энергии нужно</label><div class="energy" data-group="sen">' +
      [1, 2, 3].map(i => '<button type="button" class="' + (i === 1 ? 'on' : '') + '" data-act="pickStepEnergy" data-group="sen" data-v="' + i + '">' + MP.BATT[i] + '</button>').join('') + '</div>' +
      buttons('Добавить') + '</form>');
  };
  MP.acts.pickStepEnergy = el => { newStepEnergy = +el.dataset.v; MP.paintGroup('sen', newStepEnergy); };
  MP.acts.saveStep = form => {
    const text = val(form, 'text');
    if (!text) return;
    const minutes = Math.max(0, +form.elements.minutes.value || 0);
    const step = D.addStep(form.dataset.id, { text, minutes, energy: newStepEnergy });
    MP.closeModal();
    MP.render();
    if (minutes > 25) MP.toast('Больше 25 минут — может, разбить помельче?', { label: 'Разбить', onClick: () => MP.acts.splitStep({ dataset: { id: step.id } }) });
  };
})();
