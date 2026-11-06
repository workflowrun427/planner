// Мелкие помощники, которыми пользуются все остальные файлы.
(function () {
  const MP = (window.MP = window.MP || {});

  MP.CURRENCY = '₸';

  // Защита от «ломающего» текста: всё, что вводит человек, проходит через esc()
  MP.esc = s =>
    String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  MP.uid = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);

  const pad = n => String(n).padStart(2, '0');
  MP.dateStr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  MP.today = () => MP.dateStr(new Date());
  MP.nowIso = () => new Date().toISOString();
  MP.daysAgoStr = n => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return MP.dateStr(d);
  };

  MP.fmt = n => Math.round(n).toLocaleString('ru-RU');
  MP.pick = a => a[Math.floor(Math.random() * a.length)];
  MP.$ = s => document.querySelector(s);
  MP.$$ = s => Array.from(document.querySelectorAll(s));

  // Сколько целых дней назад создана запись
  MP.daysOld = rec => Math.floor((Date.now() - Date.parse(rec.createdAt)) / 864e5);

  // Открыто ли приложение с главного экрана (а не во вкладке Safari) и на iPhone/iPad ли мы
  MP.isStandalone = () => window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  MP.isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  MP.views = {}; // экраны: today, map, wins, support, more
  MP.acts = {}; // обработчики кнопок (data-act="имя")
})();
