// Экран «Сегодня» — действие: энергия дня, опоры, шаги.
(function () {
  const MP = window.MP;
  const { esc } = MP;
  const D = MP.D;

  function greeting() {
    const h = new Date().getHours();
    return (h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер') + ' 🌿';
  }

  MP.views.today = function () {
    const en = D.dayEnergy();
    const dateStr = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    let h = '<h1>' + greeting() + '</h1><div class="sub">' + dateStr + '</div>';
    // На iPhone данные в Safari и в приложении с главного экрана хранятся раздельно — предупреждаем один раз
    if (MP.isIOS() && !MP.isStandalone() && !localStorage.getItem('mypath-hint-install')) {
      h += '<div class="hint" style="margin-top:12px"><b>Сначала установи на главный экран.</b> Данные в Safari и в приложении с главного экрана хранятся раздельно, поэтому лучше сразу начинать в установленном приложении. Как это сделать — в «Ещё».' +
        ' <button class="linkb" data-act="dismissInstallHint">Понятно</button></div>';
    }

    h += '<h2>Сколько у меня сегодня энергии?</h2><div class="card">' + MP.scaleButtons('day', 5, en, 'setEnergy') +
      '<div class="meta" style="margin-top:8px">1 — еле-еле, 5 — полна сил. Шаги подберутся под твою энергию.</div></div>';

    // опоры
    const anchors = D.anchors();
    h += '<h2>🌱 Опоры</h2><div class="card">';
    h += anchors.length
      ? anchors.map(a => {
          const on = D.anchorDone(a.id);
          return '<div class="check ' + (on ? 'done' : '') + '" data-act="toggleAnchor" data-id="' + a.id + '" role="button" aria-pressed="' + on + '">' +
            '<span class="dotbtn"><span class="dot ' + (on ? 'on' : '') + '">' + (on ? '✓' : '') + '</span></span>' +
            '<div class="txt grow">' + esc(a.text) + '</div><span class="meta">' + D.sphere(a.sphereId).emoji + '</span></div>';
        }).join('')
      : '<div class="empty">Добавь опоры во вкладке «Ещё»</div>';
    h += '</div>';

    // шаги
    const t = D.todaySteps();
    const list = [...t.pinned, ...t.suggested];
    h += '<h2>👣 Шаги на сегодня</h2>';
    if (!list.length) {
      h += '<div class="card empty">' + (en && en <= 2
        ? 'Сегодня можно только опоры — этого достаточно 💛'
        : 'Подходящих шагов пока нет. Загляни на «Карту» и закрепи шаг ⭐ — он появится здесь.') + '</div>';
    } else {
      h += '<div class="card">' + list.map(f => MP.stepRow(f.step, f.project, 'today')).join('') + '</div>';
      if (!t.pinned.length || en === 0) {
        h += '<div class="meta" style="margin:-4px 4px 10px">' +
          (en === 0 ? 'Пока не выбрана энергия, показываю самые лёгкие шаги.' : 'Подобрано под энергию ' + en + '.') + '</div>';
      }
    }

    const doneToday = D.wins().filter(w => w.date === MP.today() && w.type === 'step').length;
    if (doneToday) h += '<div class="hint">Сегодня уже сделано шагов: <b>' + doneToday + '</b>. Это считается 🌿</div>';
    return h;
  };

  MP.acts.dismissInstallHint = () => { try { localStorage.setItem('mypath-hint-install', '1'); } catch (e) {} MP.render(); };

  MP.acts.setEnergy = el => {
    D.setEnergy(+el.dataset.v);
    MP.render();
  };

  MP.acts.toggleAnchor = el => {
    const on = D.toggleAnchor(el.dataset.id);
    MP.render();
    if (on) {
      MP.toast(MP.pick(MP.PRAISE));
      if (D.allAnchorsDone()) MP.burst(14);
    }
  };
})();
