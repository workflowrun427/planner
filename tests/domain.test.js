// Проверки логики. Все данные вымышленные.
var MP = window.MP, S = MP.Store, D = MP.D;
S.load();

print('Начальные данные');
check('5 сфер', D.spheres().length === 5);
check('один стартовый проект в работе', D.projects('active').length === 1);
check('4 опоры', D.anchors().length === 4);
['spheres','projects','stages','steps','anchors'].forEach(function (c) {
  check('у всех записей ' + c + ' есть id/updatedAt/deletedAt', S.all()[c].every(function (r) { return r.id && r.updatedAt && r.deletedAt === null; }));
});

print('Подбор шагов по энергии');
var p1 = D.addProject({ name: 'Тестовый сад', sphereId: 'home' });
var st1 = D.addStage(p1.id, 'Подготовка');
D.addStep(st1.id, { text: 'Купить семена', minutes: 10, energy: 3 });
var seedProj = D.projects('active').filter(function (p) { return p.id === 'seed-project-1'; })[0];
// у стартового проекта следующий шаг — уровня 1, у «сада» — уровня 3
function titles() { var t = D.todaySteps(); return t.suggested.map(function (f) { return f.step.text; }); }
check('энергия не выбрана → только уровень 1', titles().length === 1 && D.todaySteps().max === 1);
D.setEnergy(2); check('энергия 2 → максимум уровень 1', D.todaySteps().max === 1 && titles().indexOf('Купить семена') < 0);
D.setEnergy(3); check('энергия 3 → максимум уровень 2', D.todaySteps().max === 2 && titles().indexOf('Купить семена') < 0);
D.setEnergy(4); check('энергия 4 → уровень 3 виден', D.todaySteps().max === 3 && titles().indexOf('Купить семена') >= 0);
D.setEnergy(5); check('энергия 5 → уровень 3 виден', titles().indexOf('Купить семена') >= 0);

print('Закреплённые шаги');
D.setEnergy(1);
var hard = D.steps(st1.id)[0];
D.pinStep(hard.id);
check('закреплённый шаг виден даже при низкой энергии', D.todaySteps().pinned.length === 1);
check('закреплённый не дублируется в подборе', D.todaySteps().suggested.every(function (f) { return f.step.id !== hard.id; }));
D.pinStep(hard.id);

print('Лимит активных проектов');
var p2 = D.addProject({ name: 'Тест 2', sphereId: 'mine' });
var p3 = D.addProject({ name: 'Тест 3', sphereId: 'mine' });
check('второй проект встал в работу, третий — в очередь (стартовый + «Сад» уже заняли места)', p1.status === 'active' && p2.status === 'active' && D.activeCount() === 3 && p3.status === 'queue');
check('активных не больше 3', D.activeCount() <= 3);
var queued = D.projects('queue')[0];
check('есть проект в очереди', !!queued);
check('нельзя взять 4-й в работу', D.setStatus(queued.id, 'active').ok === false);
D.setStatus(p1.id, 'queue');
check('после освобождения места можно взять в работу', D.setStatus(queued.id, 'active').ok === true);

print('Закрытие этапа и проекта; снятие отметки');
D.setStatus(p1.id, 'queue'); D.setStatus(queued.id, 'queue'); // освободим место
var pp = D.addProject({ name: 'Малый проект', sphereId: 'cats' });
var sa = D.addStage(pp.id, 'Этап А'), sb = D.addStage(pp.id, 'Этап Б');
var a1 = D.addStep(sa.id, { text: 'Шаг 1', minutes: 5, energy: 1 });
var b1 = D.addStep(sb.id, { text: 'Шаг 2', minutes: 5, energy: 1 });
var r1 = D.completeStep(a1.id);
check('закрыт этап А', r1.stageClosed && !r1.projectDone);
check('победа за шаг записана', S.get('wins', 'win-step-' + a1.id).deletedAt === null);
var r2 = D.completeStep(b1.id);
check('закрыт проект', r2.stageClosed && r2.projectDone && D.project(pp.id).status === 'done');
check('повторное завершение шага ничего не делает', D.completeStep(b1.id) === null);
var back = D.uncompleteStep(b1.id);
check('снятие отметки возвращает проект в работу', back === 'active' && D.project(pp.id).status === 'active');
check('победы за этап/проект убраны, за первый шаг осталась', !!S.get('wins', 'win-project-' + pp.id).deletedAt && S.get('wins', 'win-step-' + a1.id).deletedAt === null);
D.completeStep(b1.id);
D.setStatus(p1.id, 'active'); D.setStatus(p2.id, 'active'); D.setStatus(p3.id, 'active');
D.setStatus(queued.id, 'queue');
D.projects('active').forEach(function (p) { if (p.id !== 'seed-project-1' && p.id !== p1.id && p.id !== p2.id && p.id !== pp.id) D.setStatus(p.id, 'queue'); });
D.setStatus(p1.id, 'active'); D.setStatus(p2.id, 'active');
check('перед проверкой в работе ровно 3 других проекта', D.activeCount() === 3 && D.project(pp.id).status === 'done');
var back2 = D.uncompleteStep(b1.id);
check('если мест нет, проект уходит в очередь', back2 === 'queue' && D.project(pp.id).status === 'queue');
check('новый шаг в завершённом проекте тоже открывает его', (function () {
  var q = D.addProject({ name: 'Ещё один', sphereId: 'work' }); var s = D.addStage(q.id, 'Э'); var t = D.addStep(s.id, { text: 'Х', minutes: 1, energy: 1 });
  D.completeStep(t.id); var was = D.project(q.id).status; D.addStep(s.id, { text: 'Y', minutes: 1, energy: 1 });
  return was === 'done' && D.project(q.id).status !== 'done';
})());

print('Опоры по дням');
var an = D.anchors()[0];
check('сначала не отмечена', D.anchorDone(an.id) === false);
check('отметили', D.toggleAnchor(an.id) === true && D.anchorDone(an.id));
check('вчера отметки нет, завтра тоже', !D.anchorDone(an.id, MP.daysAgoStr(1)) && !D.anchorDone(an.id, '2999-01-01'));
check('снятие убирает победу', D.toggleAnchor(an.id) === false && !D.wins().some(function (w) { return w.refId === an.id; }));
D.toggleAnchor(an.id); D.toggleAnchor(an.id); D.toggleAnchor(an.id);
check('многократные нажатия не плодят дубли', S.all().anchorLogs.filter(function (l) { return l.anchorId === an.id; }).length === 1);

print('Удаление и «Вернуть»');
var before = D.projectSteps(pp.id).length;
var list = D.deleteProject(pp.id);
check('проект и шаги скрыты', !D.projects().some(function (p) { return p.id === pp.id; }) && D.findStep(a1.id) === null);
check('записи не стёрты, а помечены deletedAt', S.get('projects', pp.id).deletedAt !== null);
D.restore(list);
check('«Вернуть» восстанавливает всё', D.projectSteps(pp.id).length === before);

print('Разбить помельче');
var ps = D.addProject({ name: 'Проект для разбиения', sphereId: 'work' });
var ss = D.addStage(ps.id, 'Этап'); var big = D.addStep(ss.id, { text: 'Большой шаг', minutes: 60, energy: 3 });
var tail = D.addStep(ss.id, { text: 'Хвост', minutes: 5, energy: 1 });
D.pinStep(big.id);
check('разбили на 3', D.splitStep(big.id, ['Раз', ' ', 'Два', 'Три']) === 3);
var names = D.steps(ss.id).map(function (s) { return s.text; });
check('порядок: Раз, Два, Три, Хвост', names.join() === 'Раз,Два,Три,Хвост');
check('новые шаги лёгкие, исходный скрыт', D.steps(ss.id).every(function (s) { return s.text === 'Хвост' || (s.energy === 1 && s.minutes === 10); }) && D.findStep(big.id) === null);
check('закрепление перешло к первому', D.steps(ss.id)[0].inToday === true && D.steps(ss.id)[1].inToday === false);
check('пустой список не разбивает', D.splitStep(tail.id, ['  ', '']) === 0 && D.findStep(tail.id) !== null);

print('Подсказка «великоват»');
var old = D.addStep(ss.id, { text: 'Давний шаг', minutes: 15, energy: 1 });
check('свежий шаг не вызывает подсказку', D.hintStepId() === null);
S.update('steps', old.id, { createdAt: new Date(Date.now() - 4 * 864e5).toISOString() });
check('шаг в проекте из очереди подсказку не вызывает', D.project(ps.id).status === 'queue' && D.hintStepId() === null);
D.projects('active').forEach(function (p) { D.setStatus(p.id, 'queue'); });
D.setStatus(ps.id, 'active');
S.update('steps', old.id, { createdAt: new Date(Date.now() - 4 * 864e5).toISOString() });
check('шаг старше 3 дней в активном проекте → подсказка', D.hintStepId() === old.id);
D.dismissHint(old.id);
check('после «оставить как есть» больше не показывается', D.hintStepId() === null);
check('стартовые шаги подсказкой не беспокоят', S.get('steps', 'seed-step-1').bigHintShown === true);

print('Накопления');
var pv = D.addProject({ name: 'Вымышленная поездка', sphereId: 'mine' });
D.updateProject(pv.id, { hasSavings: true, savingsTarget: 1000 });
var d1 = D.addDeposit(pv.id, 200, '2026-01-10');
check('200 из 1000 — границ нет', d1.pct === 0 && D.saved(pv.id) === 200);
check('победа за отметку записана с датой', S.get('wins', 'win-dep-' + d1.deposit.id).date === '2026-01-10' && S.get('wins', 'win-dep-' + d1.deposit.id).text.indexOf('Вымышленная поездка') > 0);
check('→ 300 пересекло 25%', D.addDeposit(pv.id, 100, '2026-01-11').pct === 25);
check('→ 600 пересекло 50%', D.addDeposit(pv.id, 300, '2026-01-12').pct === 50);
check('→ 800 пересекло 75%', D.addDeposit(pv.id, 200, '2026-01-13').pct === 75);
var dEnd = D.addDeposit(pv.id, 500, '2026-01-14');
check('→ 1300 пересекло 100%', dEnd.pct === 100 && D.saved(pv.id) === 1300);
check('сверх цели поздравления нет', D.addDeposit(pv.id, 50, '2026-01-15').pct === 0);
D.updateDeposit(d1.deposit.id, { amount: 250, date: '2026-01-09' });
check('исправление меняет сумму, дату и победу', D.saved(pv.id) === 1400 && S.get('wins', 'win-dep-' + d1.deposit.id).date === '2026-01-09' && S.get('wins', 'win-dep-' + d1.deposit.id).text.indexOf('250') > 0);
var dl = D.deleteDeposit(dEnd.deposit.id);
check('удаление убирает сумму и победу', D.saved(pv.id) === 900 && S.get('wins', 'win-dep-' + dEnd.deposit.id).deletedAt !== null);
D.restore(dl);
check('«Вернуть» возвращает обоих', D.saved(pv.id) === 1400 && S.get('wins', 'win-dep-' + dEnd.deposit.id).deletedAt === null);
var pn = D.addProject({ name: 'Без цели', sphereId: 'mine' }); D.updateProject(pn.id, { hasSavings: true });
check('без цели поздравлений по процентам нет', D.addDeposit(pn.id, 5000, '2026-02-01').pct === 0);

print('Волны и заметки (заметки отдельно от данных)');
var w = D.addWave({ kind: 'urge', what: 'Еда', before: 5, after: 2 }, 'Справилась с волной тяги (еда)', 'wave');
S.notes.set(w.id, ['вымышленная заметка']);
check('заметка читается', S.notes.get(w.id)[0] === 'вымышленная заметка');
check('заметки НЕ попали в основные данные и экспорт', JSON.stringify(S.exportObject()).indexOf('вымышленная заметка') < 0 && JSON.stringify(S.all().waves).indexOf('заметка') < 0);
check('волна и победа записаны', D.waves().length === 1 && S.get('wins', 'win-wave-' + w.id).waveBefore === 5);
S.notes.clear();
check('заметки стираются', S.notes.count() === 0 && D.waves().length === 1);

print('Победы: метка 💪, статистика');
var mw = D.addManualWin('Сказала, что мне неудобно', true);
check('ручная победа с 💪', mw.tag === 'assert');
check('метку можно снять и поставить', D.toggleAssert(mw.id) === false && D.toggleAssert(mw.id) === true);
var es = D.addStep(D.stages(pp.id)[0].id, { text: 'Шаг для энергии', minutes: 5, energy: 1 });
D.completeStep(es.id); D.setStepEnergy(es.id, 2, 4);
var es2 = D.addStep(D.stages(pp.id)[0].id, { text: 'Ещё шаг', minutes: 5, energy: 1 });
D.completeStep(es2.id); D.setStepEnergy(es2.id, 3, 4);
var stt = D.winStats();
check('среднее изменение энергии: (+2 и +1) → +1.5', stt.energyDelta === 1.5 && stt.energyCount === 2);
check('средняя энергия до/после для нейтрального показа: 2.5→4', stt.energyBeforeAvg === 2.5 && stt.energyAfterAvg === 4);
check('счётчик 💪 и волн', stt.assert === 1 && stt.waveCount === 1 && stt.waveBefore === 5 && stt.waveAfter === 2);
check('«за 7 дней» не больше «всего»', stt.week > 0 && stt.week <= stt.total);
D.setStepEnergy(es.id, 0, 3);
check('без обеих оценок энергия не записывается', D.winStats().energyCount === 2);

print('Экспорт и импорт');
S.notes.set('wave-x', ['секретная вымышленная заметка']);
var ex = S.exportObject(false);
check('в экспорте есть app и version', ex.app === 'mypath' && ex.version === 1 && !!ex.exportedAt && typeof ex.data === 'object');
check('экспорт хранит все 10 списков', MP.COLLECTIONS.every(function (c) { return Array.isArray(ex.data[c]); }));
check('по умолчанию заметок в файле нет', ex.privateNotes === undefined && JSON.stringify(ex).indexOf('секретная') < 0);
check('с галочкой заметки в файле есть', S.exportObject(true).privateNotes['wave-x'][0].indexOf('секретная') === 0);
check('экспорт сохраняет удалённые записи (метки deletedAt)', ex.data.projects.some(function (p) { return p.deletedAt; }) || ex.data.steps.some(function (s) { return s.deletedAt; }));
var txt = JSON.stringify(ex);
var parsed = S.parseImport(txt);
check('файл читается обратно без потерь', JSON.stringify(parsed.data) === JSON.stringify(ex.data) && parsed.kind === 'v1');

// слияние: удалённое не возвращается, новое побеждает
var pm = D.addProject({ name: 'Для слияния', sphereId: 'home' });
var snapOld = JSON.stringify(S.exportObject(false));         // копия, где проект ещё жив
D.deleteProject(pm.id);                                       // потом проект удалили
var r = S.merge(S.parseImport(snapOld).data);
check('старая копия не воскрешает удалённый проект', D.projects().every(function (p) { return p.id !== pm.id; }));
var future = JSON.parse(snapOld); // «другое устройство» правило новее
future.data.projects.forEach(function (p) { if (p.id === pm.id) { p.name = 'Правка с другого устройства'; p.deletedAt = null; p.updatedAt = '2999-01-01T00:00:00.000Z'; } });
S.merge(S.parseImport(JSON.stringify(future)).data);
check('более новая запись с другого устройства побеждает', D.project(pm.id).name === 'Правка с другого устройства' && D.project(pm.id).deletedAt === null);
var n0 = S.all().steps.length; S.merge(S.parseImport(snapOld).data);
check('повторное слияние не плодит дубли', S.all().steps.length === n0);

// замена: резервная копия и возврат
var before = D.projects().length;
S.replaceAll(S.parseImport(JSON.stringify({ app: 'mypath', version: 1, data: MP.seed() })).data);
check('замена оставляет только содержимое файла', D.projects().length === 1 && D.projects()[0].id === 'seed-project-1');
check('запасная копия создана', !!S.backupInfo());
S.restoreBackup();
check('«вернуть запасную копию» восстанавливает прежнее', D.projects().length === before);

// ошибки
function fails(t) { try { S.parseImport(t); return false; } catch (e) { return typeof e.message === 'string' && e.message.length > 5; } }
check('мусор отклоняется понятной ошибкой', fails('это не json') && fails('[1,2]') && fails('{"x":1}') && fails('null'));
check('версия новее приложения отклоняется', fails(JSON.stringify({ app: 'mypath', version: 99, data: {} })));
check('странный version отклоняется', fails(JSON.stringify({ version: 'abc', data: {} })));
var holes = S.parseImport(JSON.stringify({ app: 'mypath', version: 1, data: { projects: [{ id: 'p-a', name: 'Без дат' }, null, { name: 'без id' }, 5] } }));
check('записи без id отбрасываются, у остальных появляются updatedAt/deletedAt', holes.data.projects.length === 1 && holes.data.projects[0].deletedAt === null && !!holes.data.projects[0].updatedAt && holes.data.steps.length === 0);

// копия из прототипа (вымышленная)
var proto = { anchors: [{ id: 'a1', text: 'Тестовая опора', sphere: 'home' }], days: { '2026-03-01': { energy: 3, anchors: ['a1'] } },
  projects: [{ id: 'pr1', name: 'Вымышленная копилка', sphere: 'mine', status: 'active', savings: { target: 500, deposits: [{ amount: 100, ts: 1772000000000 }] },
    stages: [{ id: 'sg1', name: 'Этап', closed: false, steps: [{ id: 'st1', text: 'Вымышленный шаг', min: 5, en: 2, created: 1771000000000, done: true, doneAt: 1771100000000, eb: 2, ea: 4 }] }] }],
  wins: [{ id: 'w1', date: '2026-03-01', ts: 1771100000000, text: 'Вымышленная победа', type: 'step', step: 'st1', proj: 'Вымышленная копилка', eb: 2, ea: 4 }],
  waves: [{ id: 'wv1', ts: 1771200000000, date: '2026-03-01', kind: 'urge', what: 'Еда', b: 4, a: 2, notes: ['заметка из прототипа'] }] };
var lp = S.parseImport(JSON.stringify(proto));
check('прототип распознан', lp.kind === 'prototype');
check('проект, этап, шаг перенесены с новыми полями', lp.data.projects[0].hasSavings === true && lp.data.projects[0].savingsTarget === 500 && lp.data.stages[0].projectId === 'pr1' && lp.data.steps[0].minutes === 5 && lp.data.steps[0].energy === 2 && lp.data.steps[0].done === true && lp.data.steps[0].energyAfter === 4);
check('энергия дня и отметка опоры перенесены', lp.data.days[0].energy === 3 && lp.data.anchorLogs[0].id === '2026-03-01:a1');
check('победа, волна и накопление перенесены', lp.data.wins[0].refId === 'st1' && lp.data.waves[0].before === 4 && lp.data.deposits[0].amount === 100);
check('заметки из прототипа не уходят в основные данные, а ждут отдельно', JSON.stringify(lp.data).indexOf('заметка из прототипа') < 0 && lp.notes.wv1[0] === 'заметка из прототипа');
check('повторный разбор даёт те же id (без дублей)', S.parseImport(JSON.stringify(proto)).data.deposits[0].id === lp.data.deposits[0].id);
S.replaceAll(lp.data);
check('после загрузки прототипа всё видно', D.projects()[0].name === 'Вымышленная копилка' && D.saved('pr1') === 100 && D.findStep('st1').step.done);
check('у перенесённых записей есть id/updatedAt/deletedAt', MP.COLLECTIONS.every(function (c) { return S.all()[c].every(function (r) { return r.id && r.updatedAt && r.deletedAt === null; }); }));

print('Сохранение и чтение');
var snap = JSON.stringify(S.all());
S.load();
check('после перезагрузки данные те же', JSON.stringify(S.all()) === snap);
localStorage.setItem('mypath-data', '{сломано');
check('сломанные данные не стираются молча', S.load() === 'corrupt' && localStorage.getItem('mypath-corrupt') === '{сломано');

finish();
