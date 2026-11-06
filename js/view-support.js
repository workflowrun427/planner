// Экран «Поддержка» («Мне сейчас трудно»): четыре короткие практики, таймер волны, «до → после».
// Заметки, которые ты пишешь здесь, хранятся ТОЛЬКО на этом устройстве (отдельно от основных данных).
(function () {
  const MP = window.MP;
  const { esc } = MP;
  const D = MP.D;

  const SOS = {
    urge: { t: 'Тяга', e: '🌊', d: 'деньги, кредит, еда, алкоголь, лежать, листать', win: 'Справилась с волной тяги', tag: 'wave' },
    rum: { t: 'Прокручиваю обиду', e: '🔁', d: 'сцены, споры в голове', win: 'Остановила прокручивание', tag: 'wave' },
    ppl: { t: 'Кажется, что человек плохой', e: '🔍', d: 'или что ситуация ужасная', win: 'Проверила, а не поверила страху', tag: 'check' },
    crit: { t: 'Критик', e: '🗣️', d: '«я никчёмная», «опять не смогла»', win: 'Ответила критику с состраданием', tag: 'wave' }
  };
  const WHAT = ['Деньги / кредит', 'Еда', 'Алкоголь', 'Лежать', 'Телефон', 'Другое'];
  const KIND_NAME = { urge: 'Тяга', rum: 'Прокручивание', ppl: 'Проверка', crit: 'Критик' };

  let sos = {}, tmr = null;

  MP.views.support = function () {
    const st = D.winStats();
    let h = '<h1>🌊 Поддержка</h1><div class="sub">Мне сейчас трудно. Ты не обязана справляться красиво — достаточно заметить.</div><h2>Что сейчас происходит?</h2>' +
      Object.entries(SOS).map(([k, v]) => '<button class="sos-opt" data-act="sosStart" data-k="' + k + '">' + v.e + ' ' + v.t + '<small>' + v.d + '</small></button>').join('');

    h += '<h2>Мои волны</h2><div class="row"><div class="stat"><b>' + st.waveCount + '</b><span class="meta">🌊 пережито</span></div>' +
      '<div class="stat"><b>' + (st.waveBefore === null ? '—' : st.waveBefore.toFixed(1) + '→' + st.waveAfter.toFixed(1)) + '</b><span class="meta">сила до → после</span></div></div>';
    if (st.waveBefore !== null && st.waveAfter < st.waveBefore) h += '<div class="hint" style="margin-top:10px">Волны проходят: в среднем их сила падает с ' + st.waveBefore.toFixed(1) + ' до ' + st.waveAfter.toFixed(1) + '. Это твои данные, а не теория 🌊</div>';

    const recent = D.waves().slice(0, 5);
    if (recent.length) {
      h += '<div class="card" style="margin-top:10px">' + recent.map(w => {
        const ds = new Date(w.date + 'T12:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
        return '<div class="win"><span>🌊</span><div class="grow">' + (KIND_NAME[w.kind] || 'Волна') + (w.what ? ' · ' + esc(w.what.toLowerCase()) : '') +
          '<div class="meta">' + ds + (w.before && w.after ? ' · сила ' + w.before + '→' + w.after : '') + '</div></div></div>';
      }).join('') + '</div>';
    }

    const nn = MP.Store.notes.count();
    h += '<h2>Приватность</h2><div class="card"><div class="sub">Заметки отсюда хранятся только на этом устройстве и не отправляются при синхронизации. ' +
      (nn ? 'Сейчас заметок: ' + nn + '.' : 'Сейчас заметок нет.') + '</div>' +
      (nn ? '<button class="btn small ghost" style="margin-top:10px" data-act="clearNotes">Стереть все заметки с этого устройства</button>' : '') + '</div>';
    return h;
  };

  const scale = k => MP.scaleButtons(k, 5, 0, 'sosScale');
  const field = (name, label, big, ph) => '<label>' + label + '</label>' + (big ? '<textarea name="' + name + '"></textarea>' : '<input name="' + name + '" maxlength="300"' + (ph ? ' placeholder="' + ph + '"' : '') + '>');
  const box = (title, text) => '<div class="stepbox"><b>' + title + '</b>' + text + '</div>';

  MP.acts.sosStart = el => {
    clearInterval(tmr);
    const k = el.dataset.k, v = SOS[k];
    sos = { k, sb: 0, sa: 0, what: '' };
    let body = '';
    if (k === 'urge') body = '<label>Тяга к чему?</label><div>' + WHAT.map(w => '<button type="button" class="chip" data-act="sosWhat" data-w="' + esc(w) + '">' + esc(w) + '</button>').join('') + '</div>' +
      box('1. Назови', '«Это тяга. Мой мозг хочет быстрой награды».') +
      box('2. Найди её в теле', 'Где она: грудь, живот, горло? Какая: сжатие, пустота, жжение?') +
      box('3. Наблюдай, как волну с берега', 'Не борись и не исполняй. Дыши и смотри, как она меняется. Волна обычно спадает за 20–30 минут.') +
      box('4. Скажи себе', '«Конечно, я этого хочу. И я могу подождать».') +
      '<div class="timer" id="tmr">20:00</div><button type="button" class="btn ghost" style="width:100%" data-act="sosTimer">▶ Запустить таймер волны</button>';
    if (k === 'rum') body = box('1. Заметь', '«Я снова прокручиваю историю о том, как меня обидели».') +
      box('2. Это проблема или руминация?', 'Есть ли конкретное действие, которое я могу сделать: поговорить, поставить границу, прекратить общение?') +
      field('s1', 'Если есть — один шаг:', false, 'Например: написать «мне это неприятно»') +
      box('Если нет — это руминация', 'Решения она не даст. Смени состояние тела: 5 минут движения, душ, дело, которое требует внимания. Или напиши всё на бумаге — неотправленное письмо.') +
      field('s2', 'Что мне было нужно тогда? Что нужно сейчас?', false, 'Признание, уважение, защита…');
    if (k === 'ppl') body = '<div class="hint">Сигнал может быть и верным. Задача — не перестать доверять себе, а проверить.</div>' +
      field('s1', '1. Что конкретно сказали или сделали? Только факты, как на видео', true) +
      field('s2', '2. Какие ещё есть объяснения? Хотя бы два', true) +
      field('s3', '3. Можно ли уточнить у человека или подождать с выводом?', false, 'Например: спросить «что ты имеешь в виду?»');
    if (k === 'crit') body = field('s1', 'Что говорит критик?', false, '«Я опять…»') +
      box('Назови его', '«Это голос критика, а не правда обо мне». Чей это голос на самом деле?') +
      field('s2', 'Что бы я сказала подруге в такой же ситуации?', true) +
      box('Фраза сострадания', '«Мне сейчас трудно. Это нормально. Я учусь и делаю, что могу».');

    MP.onModalClose = () => clearInterval(tmr);
    MP.openModal('<h3>' + v.e + ' ' + v.t + '</h3><form data-submit="sosSave"><label>Насколько сильно сейчас?</label>' + scale('sb') + body +
      '<label>А сейчас, после?</label>' + scale('sa') +
      '<div class="hint" style="margin-top:12px">Если ты что-то здесь пишешь, это остаётся только на этом устройстве.</div>' +
      '<div class="row" style="margin-top:12px"><button type="button" class="btn ghost grow" data-act="closeModal">Закрыть</button><button type="submit" class="btn grow">Сохранить 🌿</button></div></form>');
  };

  MP.acts.sosScale = el => { const g = el.dataset.group, v = +el.dataset.v; sos[g] = v; MP.paintGroup(g, v); };
  MP.acts.sosWhat = el => {
    sos.what = el.dataset.w;
    MP.$$('#modal .chip').forEach(c => c.classList.toggle('on', c.dataset.w === sos.what));
  };

  MP.acts.sosTimer = () => {
    clearInterval(tmr);
    const end = Date.now() + 20 * 60e3;
    const tick = () => {
      const el = MP.$('#tmr');
      if (!el) return clearInterval(tmr);
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      el.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      if (s === 0) { clearInterval(tmr); el.textContent = 'Волна прошла 🌊'; }
    };
    tick();
    tmr = setInterval(tick, 1000);
  };

  MP.acts.sosSave = form => {
    clearInterval(tmr);
    const v = SOS[sos.k];
    const notes = ['s1', 's2', 's3'].map(n => form.elements[n] && form.elements[n].value.trim()).filter(Boolean);
    const w = D.addWave({ kind: sos.k, what: sos.what, before: sos.sb, after: sos.sa }, v.win + (sos.what ? ' (' + sos.what.toLowerCase() + ')' : ''), v.tag);
    if (notes.length) MP.Store.notes.set(w.id, notes); // только на устройстве
    MP.onModalClose = null;
    MP.closeModal();
    MP.render();
    MP.burst(8);
    MP.toast(sos.sb && sos.sa && sos.sa < sos.sb ? 'Было ' + sos.sb + ', стало ' + sos.sa + '. Ты справилась 🌊' : 'Ты заметила и не утонула. Это навык 🌿');
  };

  MP.acts.clearNotes = () => MP.confirmBox('Стереть все заметки из «Поддержки» с этого устройства? Вернуть их будет нельзя.', () => {
    MP.Store.notes.clear();
    MP.render();
    MP.toast('Заметки стёрты');
  }, 'Стереть');
})();
