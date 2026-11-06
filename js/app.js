// Запуск приложения, вкладки, обновление при возврате.
(function () {
  const MP = window.MP;
  const { $ } = MP;
  const VIEWS = ['today', 'map', 'wins', 'support', 'more'];

  let view = (location.hash || '#today').slice(1);
  if (!VIEWS.includes(view)) view = 'today';
  let shownDay = MP.today();

  MP.render = function () {
    shownDay = MP.today();
    MP.hintId = MP.D.hintStepId();
    $('#app').innerHTML = MP.views[view]();
    MP.$$('.nav button').forEach(b => {
      const on = b.dataset.v === view;
      b.classList.toggle('on', on);
      b.setAttribute('aria-current', on ? 'page' : 'false');
    });
    if (MP.Store.saveError) $('#app').insertAdjacentHTML('afterbegin', '<div class="hint">Не получается сохранить данные на этом устройстве (возможно, закрытый режим браузера или нет места). Сделай копию в «Ещё», пока не поздно.</div>');
  };

  MP.go = function (v) {
    if (!VIEWS.includes(v)) return;
    view = v;
    try { history.replaceState(null, '', '#' + v); } catch (e) {}
    window.scrollTo(0, 0);
    MP.render();
  };

  MP.$$('.nav button').forEach(b => (b.onclick = () => MP.go(b.dataset.v)));
  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VIEWS.includes(v) && v !== view) MP.go(v); });

  // Вернулись в приложение (после сна, из другого приложения, в новый день) — обновляем экран.
  // Опоры «сбрасываются» сами: отметка привязана к дате, у нового дня её просто нет.
  // Пока открыто окно (например, ввод текста), экран не трогаем, чтобы ничего не потерять.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (MP.modalOpen()) return;
    MP.render();
  });
  window.addEventListener('pageshow', e => { if (e.persisted && !MP.modalOpen()) MP.render(); });
  // Если приложение осталось открытым за полночь
  setInterval(() => { if (MP.today() !== shownDay && !MP.modalOpen() && document.visibilityState === 'visible') MP.render(); }, 60000);

  // Работа без интернета и установка: service worker работает только по https (и на localhost для проверки)
  MP.persisted = null;
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Вышла новая версия. Не перезагружаем сами, чтобы не потерять то, что ты сейчас пишешь.
      if (hadController) MP.toast('Вышла новая версия приложения', { label: 'Обновить', onClick: () => location.reload() });
    });
  }
  // Просим браузер не стирать данные при нехватке места (если браузер умеет)
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then(ok => { MP.persisted = ok; }).catch(() => {});
  }

  MP.Store.load();
  if (MP.Store.loadProblem) setTimeout(() => MP.toast(MP.Store.loadProblem), 300);
  MP.render();
})();
