// Правила приложения: проекты, шаги, энергия, опоры, победы.
// Здесь нет HTML — только данные и решения. Поэтому это легко проверять тестами.
(function () {
  const MP = window.MP;
  const S = MP.Store;
  const D = (MP.D = {});

  D.MAX_ACTIVE = 3;

  const cmp = (a, b) => (a.order || 0) - (b.order || 0) || (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);
  const byCreated = (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);

  // ---- сферы ----
  D.spheres = () => S.live('spheres').sort(cmp);
  D.sphere = id => S.get('spheres', id) || { id: '', name: 'Без сферы', emoji: '📌' };

  // ---- проекты, этапы, шаги ----
  D.project = id => S.get('projects', id);
  D.projects = status => S.live('projects').filter(p => !status || p.status === status).sort(byCreated);
  D.activeCount = () => D.projects('active').length;
  D.stages = pid => S.live('stages').filter(s => s.projectId === pid).sort(cmp);
  D.steps = stageId => S.live('steps').filter(s => s.stageId === stageId).sort(cmp);
  D.projectSteps = pid => D.stages(pid).flatMap(st => D.steps(st.id));

  D.progress = pid => {
    const all = D.projectSteps(pid);
    return all.length ? Math.round((all.filter(s => s.done).length / all.length) * 100) : 0;
  };

  D.nextStep = pid => {
    for (const st of D.stages(pid)) {
      const s = D.steps(st.id).find(x => !x.done);
      if (s) return { stage: st, step: s };
    }
    return null;
  };

  // Находит шаг вместе с его этапом и проектом (только если ничего из этого не удалено)
  D.findStep = id => {
    const step = S.get('steps', id);
    if (!step || step.deletedAt) return null;
    const stage = S.get('stages', step.stageId);
    if (!stage || stage.deletedAt) return null;
    const project = S.get('projects', stage.projectId);
    if (!project || project.deletedAt) return null;
    return { step, stage, project };
  };

  D.stageDone = stageId => {
    const steps = D.steps(stageId);
    return steps.length > 0 && steps.every(s => s.done);
  };

  // Проект завершён, когда в нём есть шаги и все этапы с шагами закрыты (пустые этапы не мешают)
  D.projectDone = pid => {
    const withSteps = D.stages(pid).filter(st => D.steps(st.id).length);
    return withSteps.length > 0 && withSteps.every(st => D.stageDone(st.id));
  };

  const nextOrder = list => (list.length ? Math.max(...list.map(x => x.order || 0)) + 1 : 0);

  // Статус для проекта, который «возвращается к жизни»: в работу, если есть место, иначе в очередь
  const freeStatus = () => (D.activeCount() < D.MAX_ACTIVE ? 'active' : 'queue');

  D.addProject = ({ name, sphereId }) =>
    S.add('projects', { name, sphereId, status: freeStatus(), hasSavings: false, savingsTarget: 0 });

  D.updateProject = (id, patch) => S.update('projects', id, patch);

  // Срок проекта — мягкий ориентир. Возвращает {left: дней до срока (отрицательное — срок прошёл), date} или null
  D.dueInfo = p => {
    if (!p.dueDate) return null;
    const left = Math.round((new Date(p.dueDate + 'T12:00') - new Date(MP.today() + 'T12:00')) / 864e5);
    return { left, date: p.dueDate };
  };
  D.shiftDue = (id, days) => {
    const p = D.project(id), base = p.dueDate && D.dueInfo(p).left > 0 ? p.dueDate : MP.today();
    const d = new Date(base + 'T12:00'); d.setDate(d.getDate() + days);
    return S.update('projects', id, { dueDate: MP.dateStr(d) });
  };

  // Возвращает {ok:false} если в работе уже максимум
  D.setStatus = (id, status) => {
    if (status === 'active' && D.project(id).status !== 'active' && D.activeCount() >= D.MAX_ACTIVE) return { ok: false };
    S.update('projects', id, { status });
    return { ok: true };
  };

  const reopen = pid => {
    const p = D.project(pid);
    if (p && p.status === 'done') {
      const status = freeStatus();
      S.update('projects', pid, { status });
      return status;
    }
    return null;
  };

  D.addStage = (pid, name) => {
    reopen(pid);
    return S.add('stages', { projectId: pid, name, order: nextOrder(D.stages(pid)) });
  };

  D.addStep = (stageId, { text, minutes, energy }) => {
    const stage = S.get('stages', stageId);
    reopen(stage.projectId);
    return S.add('steps', {
      stageId, text, minutes: minutes || 0, energy: energy || 1, order: nextOrder(D.steps(stageId)),
      done: false, doneAt: null, inToday: false, energyBefore: null, energyAfter: null
    });
  };

  D.pinStep = id => {
    const f = D.findStep(id);
    S.update('steps', id, { inToday: !f.step.inToday });
    return !f.step.inToday;
  };

  // ---- удаление и «Вернуть» ----
  // Каждая функция возвращает список удалённого, чтобы кнопка «Вернуть» могла его восстановить.
  const rm = (list, c, id) => { if (S.remove(c, id)) list.push({ c, id }); };

  D.deleteStep = id => { const l = []; rm(l, 'steps', id); return l; };
  D.deleteStage = id => {
    const l = [];
    D.steps(id).forEach(s => rm(l, 'steps', s.id));
    rm(l, 'stages', id);
    return l;
  };
  D.deleteProject = id => {
    const l = [];
    D.stages(id).forEach(st => {
      D.steps(st.id).forEach(s => rm(l, 'steps', s.id));
      rm(l, 'stages', st.id);
    });
    S.live('deposits').filter(d => d.projectId === id).forEach(d => rm(l, 'deposits', d.id));
    rm(l, 'projects', id);
    return l;
  };
  D.deleteAnchor = id => { const l = []; rm(l, 'anchors', id); return l; };
  D.restore = list => list.forEach(({ c, id }) => S.restore(c, id));

  // ---- энергия и подбор шагов на сегодня ----
  D.dayEnergy = (date = MP.today()) => {
    const d = S.get('days', date);
    return d && !d.deletedAt ? d.energy || 0 : 0;
  };
  D.setEnergy = (n, date = MP.today()) => S.upsert('days', date, { date, energy: n });

  // Энергия дня → максимальный уровень шага. Не выбрана → только уровень 1.
  D.maxStepEnergy = en => (en >= 4 ? 3 : en === 3 ? 2 : 1);

  D.todaySteps = (date = MP.today()) => {
    const max = D.maxStepEnergy(D.dayEnergy(date));
    const pinned = [], suggested = [];
    S.live('steps').filter(s => !s.done && s.inToday).sort(cmp).forEach(s => {
      const f = D.findStep(s.id);
      if (f) pinned.push(f);
    });
    D.projects('active').forEach(p => {
      const n = D.nextStep(p.id);
      if (n && !n.step.inToday && n.step.energy <= max) suggested.push({ step: n.step, stage: n.stage, project: p });
    });
    return { pinned, suggested: suggested.slice(0, 3), max };
  };

  // ---- опоры (ежедневные галочки) ----
  D.anchors = () => S.live('anchors').sort(cmp);
  // schedule: { days: [1..7] (Пн=1; пусто = каждый день), biweekly: true = только раз в 2 недели }
  D.addAnchor = (text, sphereId, schedule) =>
    S.add('anchors', { text, sphereId, order: nextOrder(D.anchors()), days: (schedule && schedule.days) || [], biweekly: !!(schedule && schedule.biweekly) });
  D.updateAnchor = (id, patch) => S.update('anchors', id, patch);

  const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  D.DAY_NAMES = DAY_NAMES;
  const isoDow = date => new Date(date + 'T12:00').getDay() || 7;
  const mondayMs = date => { const d = new Date(date + 'T12:00'); d.setDate(d.getDate() - (isoDow(date) - 1)); return d.getTime(); };

  // Нужна ли опора в этот день: по дням недели и (если «раз в 2 недели») по чётности недели от даты создания
  D.anchorDue = (a, date = MP.today()) => {
    if (a.days && a.days.length && a.days.indexOf(isoDow(date)) < 0) return false;
    if (a.biweekly) {
      const weeks = Math.round((mondayMs(date) - mondayMs(a.createdAt.slice(0, 10))) / (7 * 864e5));
      return (((weeks % 2) + 2) % 2) === 0;
    }
    return true;
  };
  D.anchorsFor = (date = MP.today()) => D.anchors().filter(a => D.anchorDue(a, date));
  D.scheduleText = a => {
    const days = (a.days || []).slice().sort((x, y) => x - y).map(d => DAY_NAMES[d - 1]);
    const base = days.length && days.length < 7 ? days.join(', ') : (a.biweekly ? '' : 'каждый день');
    return a.biweekly ? (base ? base + ' · ' : '') + 'раз в 2 недели' : base;
  };

  const logId = (date, aid) => date + ':' + aid;
  D.anchorDone = (aid, date = MP.today()) => {
    const l = S.get('anchorLogs', logId(date, aid));
    return !!l && !l.deletedAt;
  };
  D.allAnchorsDone = (date = MP.today()) => {
    const a = D.anchorsFor(date);
    return a.length > 0 && a.every(x => D.anchorDone(x.id, date));
  };

  // Включает или выключает опору за сегодня. Возвращает true, если теперь отмечена.
  D.toggleAnchor = id => {
    const date = MP.today(), lid = logId(date, id);
    if (D.anchorDone(id, date)) {
      S.remove('anchorLogs', lid);
      S.remove('wins', 'win-' + lid);
      return false;
    }
    const a = S.get('anchors', id);
    S.upsert('anchorLogs', lid, { date, anchorId: id });
    D.addWin('win-' + lid, { type: 'anchor', text: a.text, refId: id });
    return true;
  };

  // ---- победы ----
  // id победы предсказуем (например win-step-<id>): отметил, снял, отметил снова — дублей нет
  D.addWin = (id, fields) =>
    S.upsert('wins', id, Object.assign({ date: MP.today(), tag: null, labels: [], refId: null, projectName: null, energyBefore: null, energyAfter: null, waveBefore: null, waveAfter: null }, fields));

  D.wins = () => S.live('wins').sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  // ---- выполнение шага ----
  // Возвращает {stageClosed, projectDone, stageName, projectName}
  D.completeStep = id => {
    const f = D.findStep(id);
    if (!f || f.step.done) return null;
    S.update('steps', id, { done: true, doneAt: MP.nowIso(), inToday: false });
    D.addWin('win-step-' + id, { type: 'step', text: f.step.text, refId: id, projectName: f.project.name });
    const res = { stageClosed: false, projectDone: false, stageName: f.stage.name, projectName: f.project.name };
    if (D.stageDone(f.stage.id)) {
      res.stageClosed = true;
      D.addWin('win-stage-' + f.stage.id, { type: 'stage', text: 'Этап «' + f.stage.name + '» — ' + f.project.name, refId: f.stage.id });
    }
    if (D.projectDone(f.project.id) && f.project.status !== 'done') {
      res.projectDone = true;
      S.update('projects', f.project.id, { status: 'done' });
      D.addWin('win-project-' + f.project.id, { type: 'project', text: 'Проект «' + f.project.name + '» завершён!', refId: f.project.id });
    }
    return res;
  };

  // Записать энергию до/после (необязательно)
  D.setStepEnergy = (id, before, after) => {
    if (!before || !after) return;
    S.update('steps', id, { energyBefore: before, energyAfter: after });
    if (S.get('wins', 'win-step-' + id)) S.update('wins', 'win-step-' + id, { energyBefore: before, energyAfter: after });
  };

  // Снять отметку. Если проект был завершён — он снова становится активным
  // (или уходит в очередь, если активных уже максимум). Возвращает 'active' | 'queue' | null.
  D.uncompleteStep = id => {
    const f = D.findStep(id);
    if (!f || !f.step.done) return null;
    S.update('steps', id, { done: false, doneAt: null, energyBefore: null, energyAfter: null });
    S.remove('wins', 'win-step-' + id);
    S.remove('wins', 'win-stage-' + f.stage.id);
    S.remove('wins', 'win-project-' + f.project.id);
    return reopen(f.project.id);
  };

  // ---- «Разбить помельче» и мягкая подсказка «великоват» ----
  D.splitStep = (id, lines) => {
    const f = D.findStep(id);
    const clean = lines.map(x => x.trim()).filter(Boolean);
    if (!f || !clean.length) return 0;
    clean.forEach((text, i) =>
      S.add('steps', {
        stageId: f.stage.id, text, minutes: 10, energy: 1, order: (f.step.order || 0) + (i * 0.9) / clean.length,
        done: false, doneAt: null, inToday: i === 0 && f.step.inToday, energyBefore: null, energyAfter: null, bigHintShown: true
      })
    );
    S.remove('steps', id);
    return clean.length;
  };

  // Подсказка показывается один раз для шага, который висит 3+ дня, и только для одного шага за раз.
  // Нажали «Оставить как есть» или «Разбить» — больше этот шаг не беспокоим.
  D.hintStepId = () => {
    const cand = S.live('steps').filter(s => !s.done && !s.bigHintShown && MP.daysOld(s) >= 3 && D.findStep(s.id) && D.findStep(s.id).project.status === 'active');
    cand.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    return cand.length ? cand[0].id : null;
  };
  D.dismissHint = id => S.update('steps', id, { bigHintShown: true });

  // ---- накопления ----
  const sortDeposits = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.createdAt < b.createdAt ? 1 : -1);
  D.deposits = pid => S.live('deposits').filter(d => d.projectId === pid).sort(sortDeposits);
  D.saved = pid => D.deposits(pid).reduce((s, d) => s + d.amount, 0);
  const depText = (p, amount) => 'Отложила ' + MP.fmt(amount) + ' ' + MP.CURRENCY + ' на «' + p.name + '»';

  // Возвращает {deposit, pct}: pct — 25/50/75/100, если этой отметкой пересечена граница цели, иначе 0
  D.addDeposit = (pid, amount, date) => {
    const p = D.project(pid), before = D.saved(pid), after = before + amount, t = p.savingsTarget || 0;
    const deposit = S.add('deposits', { projectId: pid, amount, date });
    D.addWin('win-dep-' + deposit.id, { type: 'save', tag: 'save', text: depText(p, amount), refId: deposit.id, date });
    let pct = 0;
    if (t > 0) [25, 50, 75, 100].forEach(m => { if (before < (t * m) / 100 && after >= (t * m) / 100) pct = m; });
    return { deposit, pct };
  };
  D.updateDeposit = (id, { amount, date }) => {
    const dep = S.update('deposits', id, { amount, date });
    if (S.get('wins', 'win-dep-' + id)) S.update('wins', 'win-dep-' + id, { text: depText(D.project(dep.projectId), amount), date });
  };
  D.deleteDeposit = id => {
    const l = [];
    rm(l, 'deposits', id);
    rm(l, 'wins', 'win-dep-' + id);
    return l;
  };

  // ---- волны («Поддержка»). Здесь только цифры; заметки хранятся отдельно, на устройстве ----
  D.waves = () => S.live('waves').sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  D.addWave = ({ kind, what, before, after }, winText, tag) => {
    const w = S.add('waves', { date: MP.today(), kind, what: what || '', before: before || 0, after: after || 0 });
    D.addWin('win-wave-' + w.id, { type: 'wave', tag, text: winText, refId: w.id, waveBefore: before || null, waveAfter: after || null });
    return w;
  };

  // ---- ручные победы, метка 💪, статистика ----
  // Удалить победу (мягко: можно вернуть). Сам шаг или опора при этом остаются выполненными.
  D.deleteWin = id => { const l = []; rm(l, 'wins', id); return l; };
  D.addManualWin = (text, assert, labels) => D.addWin('win-' + MP.uid(), { type: 'manual', text, tag: assert ? 'assert' : null, labels: labels || [] });

  // Свои метки (название + значок). Ставятся на любую победу; у победы может быть несколько.
  D.tags = () => S.live('tags').sort(cmp);
  D.addTag = (name, emoji) => S.add('tags', { name, emoji: emoji || '⭐', order: nextOrder(D.tags()) });
  D.updateTag = (id, patch) => S.update('tags', id, patch);
  D.deleteTag = id => { const l = []; rm(l, 'tags', id); return l; };
  D.winLabels = w => (w.labels || []).filter(id => { const t = S.get('tags', id); return t && !t.deletedAt; });
  D.toggleLabel = (winId, tagId) => {
    const w = S.get('wins', winId), cur = w.labels || [];
    const next = cur.indexOf(tagId) >= 0 ? cur.filter(x => x !== tagId) : cur.concat(tagId);
    S.update('wins', winId, { labels: next });
    return next.indexOf(tagId) >= 0;
  };
  D.toggleAssert = id => {
    const w = S.get('wins', id);
    return S.update('wins', id, { tag: w.tag === 'assert' ? null : 'assert' }).tag === 'assert';
  };

  const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  D.winStats = () => {
    const wins = D.wins(), since = MP.daysAgoStr(6);
    const withE = wins.filter(w => w.energyBefore && w.energyAfter);
    const waves = D.waves().filter(w => w.before && w.after);
    return {
      total: wins.length,
      week: wins.filter(w => w.date >= since).length,
      energyDelta: avg(withE.map(w => w.energyAfter - w.energyBefore)),
      energyBeforeAvg: avg(withE.map(w => w.energyBefore)),
      energyAfterAvg: avg(withE.map(w => w.energyAfter)),
      energyCount: withE.length,
      assert: wins.filter(w => w.tag === 'assert').length,
      waveCount: D.waves().length,
      waveBefore: avg(waves.map(w => w.before)),
      waveAfter: avg(waves.map(w => w.after))
    };
  };
})();
