// Экран «Ещё». Пока здесь только опоры; экспорт/импорт и установка добавятся на следующих этапах.
(function () {
  const MP = window.MP;
  const { esc } = MP;
  const D = MP.D;

  MP.views.more = function () {
    let h = '<h1>⚙️ Ещё</h1><h2>Мои опоры</h2><div class="card"><div class="sub" style="margin-bottom:6px">Маленькие регулярные дела. Можно каждый день, в выбранные дни недели или раз в 2 недели. Отметки идут заново каждый раз — без счётчика «дней подряд».</div>' +
      D.anchors().map(a =>
        '<div class="check"><span>' + D.sphere(a.sphereId).emoji + '</span><div class="grow">' + esc(a.text) + '<div class="meta">' + esc(D.scheduleText(a)) + '</div></div>' +
        '<button class="ic" aria-label="Изменить опору" data-act="editAnchor" data-id="' + a.id + '">✎</button>' +
        '<button class="ic" aria-label="Удалить опору" data-act="delAnchor" data-id="' + a.id + '">🗑</button></div>'
      ).join('') +
      '<button class="btn small ghost" style="margin-top:10px" data-act="newAnchor">+ Новая опора</button></div>';

    // ---- где живут мои данные (помогает заметить, если данные вдруг пропали) ----
    const sa = MP.isStandalone();
    const since = MP.Store.firstRunAt();
    h += '<h2>Где хранятся мои данные</h2><div class="card">' +
      '<div class="row"><span style="font-size:22px">' + (sa ? '📱' : '🌐') + '</span><div class="grow"><b>' + (sa ? 'Ты в приложении с главного экрана' : 'Ты во вкладке браузера') + '</b></div></div>' +
      '<div class="sub" style="margin-top:6px">' + (sa
        ? 'Здесь живут твои данные. Во вкладке Safari данные другие — они не переносятся сами.'
        : 'Данные во вкладке браузера и в установленном приложении — <b>раздельные</b>. Если используешь приложение с главного экрана, веди всё там.') + '</div>' +
      '<div class="meta" style="margin-top:8px">Данные на этом устройстве ведутся с: ' + (since ? new Date(since).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/\.$/, '') : '—') +
      '. Если эта дата вдруг станет сегодняшней, а ты ничего не стирала, значит, данные пропали — загрузи файл-копию.</div>' +
      '<div class="meta" style="margin-top:4px">Защита от автоочистки: ' + (MP.persisted === true ? 'включена' : MP.persisted === false ? 'браузер не подтвердил' : 'не проверена') + '.</div></div>' +
      '<details class="card"><summary><b>Как установить на iPhone ▾</b></summary><ol class="steps">' +
      '<li>Открой адрес приложения в <b>Safari</b> (именно в нём, не в другом браузере).</li>' +
      '<li>Нажми кнопку «Поделиться» (квадрат со стрелкой вверх внизу экрана).</li>' +
      '<li>Прокрути список и выбери <b>«На экран “Домой”»</b>.</li>' +
      '<li>Нажми «Добавить». Иконка появится на главном экране.</li>' +
      '<li>Дальше открывай приложение с иконки. <b>Данные вноси только там.</b></li></ol></details>';

    h += MP.syncCard();

    // ---- данные ----
    const last = MP.Store.lastExportAt(), bk = MP.Store.backupInfo();
    const when = iso => new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    h += '<h2>Мои данные</h2><div class="card"><div class="sub">Данные хранятся только на этом устройстве. Файл-копию стоит сохранять иногда — например, раз в неделю или перед сменой телефона.</div>' +
      '<div class="meta" style="margin:8px 0">' + (last ? 'Последняя копия: ' + when(last) : 'Копию ещё не сохраняла — это нормально, просто пока без страховки.') + '</div>' +
      '<label class="switch"><input type="checkbox" id="f-notes"> <span>Добавить в файл заметки из «Поддержки»</span></label>' +
      '<div class="meta" style="margin-bottom:10px">По умолчанию заметки в файл не попадают — они остаются только на устройстве.</div>' +
      '<div class="row wrapr"><button class="btn small" data-act="exportFile">Сохранить копию в файл</button>' +
      '<button class="btn small ghost" data-act="pickFile">Загрузить копию из файла</button></div>' +
      '<div class="row wrapr" style="margin-top:8px"><button class="linkb" data-act="exportText">скопировать копию как текст</button>' +
      '<button class="linkb" data-act="importText">вставить текст копии</button></div>' +
      '<input type="file" id="f-file" accept=".json,application/json" hidden>' +
      (bk ? '<div class="meta" style="margin-top:10px">Перед последней заменой или объединением данных сохранилась запасная копия от ' + when(bk.savedAt) + '. <button class="linkb" data-act="undoReplace">Вернуть её</button></div>' : '') +
      '</div>';
    return h;
  };

  // ---- сохранить в файл ----
  const fileName = () => 'mypath-' + MP.today() + '.json';
  const exportText = () => JSON.stringify(MP.Store.exportObject(!!(MP.$('#f-notes') && MP.$('#f-notes').checked)), null, 2);

  MP.acts.exportFile = () => {
    MP.saveFile(exportText(), fileName(), msg => { MP.Store.markExported(); MP.render(); MP.toast(msg); }, 'Копия сохранена 💛');
  };

  MP.acts.exportText = () => {
    const text = exportText();
    const ok = () => { MP.Store.markExported(); MP.render(); MP.toast('Копия скопирована. Вставь её, например, в Заметки'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, () => showText(text));
    else showText(text);
  };
  function showText(text) {
    MP.openModal('<h3>Копия данных</h3><div class="hint">Выдели весь текст, скопируй и сохрани где-нибудь надёжно.</div><textarea id="f-text" readonly style="min-height:200px"></textarea>' +
      '<div class="row" style="margin-top:14px"><button class="btn grow" data-act="closeModal">Закрыть</button></div>');
    const t = MP.$('#f-text'); t.value = text; t.focus(); t.select();
    MP.Store.markExported();
  }

  // ---- загрузить ----
  let pending = null;
  const count = (d, c) => d[c].filter(r => !r.deletedAt).length;

  function offerImport(text) {
    let res;
    try { res = MP.Store.parseImport(text); } catch (e) { return MP.toast(e.message); }
    pending = res;
    const d = res.data;
    MP.openModal('<h3>Что делаем с этой копией?</h3>' +
      '<div class="hint">' + (res.kind === 'prototype' ? 'Это копия из прототипа — перенесу её в новый формат. ' : '') +
      'В копии: проектов — <b>' + count(d, 'projects') + '</b>, шагов — <b>' + count(d, 'steps') + '</b>, побед — <b>' + count(d, 'wins') + '</b>' +
      (res.exportedAt ? ' (сохранена ' + new Date(res.exportedAt).toLocaleDateString('ru-RU') + ')' : '') + '.' +
      (res.notes ? ' В файле есть и заметки из «Поддержки».' : '') + '</div>' +
      '<button class="sos-opt" data-act="doImport" data-mode="merge">Объединить с тем, что здесь<small>Рекомендую. Ничего не пропадёт: берутся записи, которые новее. Удалённое не возвращается.</small></button>' +
      '<button class="sos-opt" data-act="doImport" data-mode="replace">Заменить всё содержимое<small>Всё, что сейчас в приложении, заменится копией. Текущее сохранится как запасная копия — её можно вернуть.</small></button>' +
      '<button class="btn ghost" style="width:100%;margin-top:6px" data-act="closeModal">Отмена</button>');
  }

  MP.acts.pickFile = () => MP.$('#f-file').click();
  document.addEventListener('change', e => {
    if (e.target.id !== 'f-file') return;
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { e.target.value = ''; return MP.toast('Файл слишком большой для копии данных.'); }
    const r = new FileReader();
    r.onload = () => offerImport(String(r.result));
    r.onerror = () => MP.toast('Не получилось прочитать файл.');
    r.readAsText(f);
    e.target.value = ''; // чтобы тот же файл можно было выбрать ещё раз
  });

  MP.acts.importText = () => {
    MP.openModal('<h3>Вставить текст копии</h3><form data-submit="importTextGo"><textarea name="t" style="min-height:160px" placeholder="Вставь сюда скопированный текст"></textarea>' +
      '<div class="row" style="margin-top:14px"><button type="button" class="btn ghost grow" data-act="closeModal">Отмена</button><button type="submit" class="btn grow">Дальше</button></div></form>');
  };
  MP.acts.importTextGo = form => { const t = form.elements.t.value.trim(); if (t) offerImport(t); };

  MP.acts.doImport = el => {
    if (!pending) return;
    const { data, notes } = pending;
    pending = null;
    let msg;
    if (el.dataset.mode === 'replace') {
      MP.Store.replaceAll(data);
      msg = 'Данные заменены. Прежние — в запасной копии.';
    } else {
      const r = MP.Store.merge(data);
      msg = 'Объединено: новых записей ' + r.added + ', обновлено ' + r.updated + '.';
    }
    MP.Store.mergeNotes(notes);
    MP.closeModal();
    MP.render();
    MP.toast(msg);
  };

  MP.acts.undoReplace = () => MP.confirmBox('Вернуть данные, которые были до последней замены? Текущие сохранятся как запасная копия.', () => {
    try { MP.Store.restoreBackup(); MP.render(); MP.toast('Прежние данные возвращены'); }
    catch (e) { MP.toast('Не получилось вернуть запасную копию.'); }
  }, 'Вернуть');

  // ---- опора: текст, сфера, дни недели, «раз в 2 недели» ----
  let anchorDays = [];
  function anchorForm(a) {
    anchorDays = a ? (a.days || []).slice() : [];
    MP.openModal('<h3>' + (a ? 'Опора' : 'Новая опора') + '</h3><form data-submit="saveAnchor" data-id="' + (a ? a.id : '') + '">' +
      '<label>Что делать</label><input name="text" required maxlength="120" placeholder="Например: Зарядка 10 минут" value="' + esc(a ? a.text : '') + '">' +
      '<label>Сфера</label>' + MP.sphereSelect(a ? a.sphereId : 'health').replace('id="f-sph"', 'name="sphere"') +
      '<label>В какие дни</label><div id="day-chips">' +
      D.DAY_NAMES.map((n, i) => '<button type="button" class="chip ' + (anchorDays.indexOf(i + 1) >= 0 ? 'on' : '') + '" data-act="toggleDay" data-d="' + (i + 1) + '">' + n + '</button>').join('') +
      '</div><div class="meta">Ничего не выбрано — значит, каждый день.</div>' +
      '<label class="switch"><input type="checkbox" name="biweekly"' + (a && a.biweekly ? ' checked' : '') + '> <span>Только раз в 2 недели</span></label>' +
      '<div class="row" style="margin-top:18px"><button type="button" class="btn ghost grow" data-act="closeModal">Отмена</button><button type="submit" class="btn grow">' + (a ? 'Сохранить' : 'Добавить') + '</button></div></form>');
  }
  MP.acts.newAnchor = () => anchorForm(null);
  MP.acts.editAnchor = el => anchorForm(MP.Store.get('anchors', el.dataset.id));
  MP.acts.toggleDay = el => {
    const d = +el.dataset.d, i = anchorDays.indexOf(d);
    if (i >= 0) anchorDays.splice(i, 1); else anchorDays.push(d);
    el.classList.toggle('on', i < 0);
  };
  MP.acts.saveAnchor = form => {
    const text = form.elements.text.value.trim();
    if (!text) return;
    const days = anchorDays.length === 7 ? [] : anchorDays.slice().sort((x, y) => x - y);
    const fields = { text, sphereId: form.elements.sphere.value, days, biweekly: form.elements.biweekly.checked };
    if (form.dataset.id) D.updateAnchor(form.dataset.id, fields);
    else D.addAnchor(text, fields.sphereId, { days, biweekly: fields.biweekly });
    MP.closeModal();
    MP.render();
  };
  MP.acts.delAnchor = el => {
    const list = D.deleteAnchor(el.dataset.id);
    MP.render();
    MP.undoToast('Опора удалена', list);
  };
})();
