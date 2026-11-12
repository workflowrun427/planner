// Начальные данные при первом запуске. Ничего личного: код можно выкладывать публично.
// Свои проекты можно добавить руками или загрузить копию из прототипа (Ещё → Загрузить файл).
//
// У начальных записей фиксированные id и «древний» updatedAt: так при будущей синхронизации
// два устройства не создадут дубликаты, а удаление или правка всегда окажутся «новее».
(function () {
  const MP = window.MP;
  const OLD = '2000-01-01T00:00:00.000Z';

  const base = (id, fields) => Object.assign({ id, createdAt: OLD, updatedAt: OLD, deletedAt: null }, fields);

  MP.SPHERE_DEFS = [
    { id: 'work', name: 'Работа', emoji: '💼' },
    { id: 'mine', name: 'Мои проекты', emoji: '✨' },
    { id: 'health', name: 'Я и здоровье', emoji: '🌱' },
    { id: 'home', name: 'Дом', emoji: '🏠' },
    { id: 'cats', name: 'Кошки', emoji: '🐈' }
  ];

  MP.emptyData = function () {
    const d = {};
    MP.COLLECTIONS.forEach(c => (d[c] = []));
    return d;
  };

  MP.seed = function () {
    const d = MP.emptyData();
    // id сфер совпадают с прототипом (work, mine…), поэтому старую копию можно загрузить без пересчёта
    MP.SPHERE_DEFS.forEach((s, i) => d.spheres.push(base(s.id, { name: s.name, emoji: s.emoji, order: i })));

    [
      ['Умыться и почистить зубы утром', 'health'],
      ['Умыться и почистить зубы вечером', 'health'],
      ['Помыть 1 вещь из посуды', 'home'],
      ['Покормить кошек и проверить лоток', 'cats']
    ].forEach(([text, sphereId], i) => d.anchors.push(base('seed-anchor-' + (i + 1), { text, sphereId, order: i })));

    d.projects.push(base('seed-project-1', { name: 'Знакомлюсь с приложением', sphereId: 'mine', status: 'active', hasSavings: false, savingsTarget: 0 }));
    d.stages.push(base('seed-stage-1', { projectId: 'seed-project-1', name: 'Первые шаги', order: 0 }));
    [
      ['Нажать на кружок рядом с этим шагом — и он засчитается', 1, 1],
      ['Открыть вкладку «Карта» и посмотреть, как устроены проекты', 5, 1],
      ['Добавить свой первый проект (кнопка «+ Проект»)', 10, 1]
    ].forEach(([text, minutes, energy], i) =>
      d.steps.push(base('seed-step-' + (i + 1), { stageId: 'seed-stage-1', text, minutes, energy, done: false, doneAt: null, inToday: false, energyBefore: null, energyAfter: null, order: i, bigHintShown: true }))
    );
    return d;
  };
})();
