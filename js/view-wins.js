// Экран «Победы»: журнал всего, что сделано, по дням.
(function () {
  const MP = window.MP;
  const { esc } = MP;
  const D = MP.D;

  let filter = 'all';
  let manualAssert = false;
  const manualLabels = new Set();

  const FILTERS = [['all', 'Все'], ['assert', '💪 Отстояла себя'], ['wave', '🌊 Волны'], ['check', '🔍 Проверила'], ['save', '🪙 Накопления'], ['steps', '👣 Шаги']];
  const ICON = { step: '👣', stage: '✅', project: '🏆', anchor: '🌱', manual: '💛', save: '🪙', wave: '🌊' };
  const stat = (n, label) => '<div class="stat"><b>' + n + '</b><span class="meta">' + label + '</span></div>';

  MP.views.wins = function () {
    const st = D.winStats();
    const d = st.energyDelta;
    const tags = D.tags();
    if (filter.indexOf('tag:') === 0 && !tags.some(t => 'tag:' + t.id === filter)) filter = 'all';
    let h = '<h1>🌿 Журнал побед</h1><div class="sub">Всё, что ты сделала. Доказательство, когда критик говорит обратное.</div>' +
      '<div class="row" style="margin:16px 0">' + stat(st.week, 'за 7 дней') + stat(st.total, 'всего') +
      stat(d === null ? '—' : st.energyBeforeAvg.toFixed(1) + '→' + st.energyAfterAvg.toFixed(1), 'энергия до → после дел') + '</div>';
    if (d !== null && d > 0) h += '<div class="hint">В среднем после дела энергии становится <b>больше</b> (по ' + st.energyCount + ' отметкам). Действие даёт силы, а не только забирает их.</div>';
    else if (d === null) h += '<div class="hint">Когда будешь отмечать энергию до и после шагов, здесь появится, как она меняется после дел.</div>';

    h += '<div class="card"><form data-submit="addManualWin"><div class="row"><input name="text" class="grow" maxlength="200" placeholder="Своя победа: например, «сказала, что мне неудобно»" required>' +
      '<button class="btn" type="submit" aria-label="Добавить победу">+</button></div>' +
      '<div style="margin-top:8px"><button type="button" class="chip ' + (manualAssert ? 'on' : '') + '" data-act="toggleManualAssert">💪 Отстояла себя</button>' +
      tags.map(t => '<button type="button" class="chip ' + (manualLabels.has(t.id) ? 'on' : '') + '" data-act="toggleManualLabel" data-id="' + t.id + '">' + esc(t.emoji) + ' ' + esc(t.name) + '</button>').join('') +
      '<button type="button" class="chip" data-act="manageTags">＋ Свои метки</button></div></form></div>';

    h += '<div>' + FILTERS.concat(tags.map(t => ['tag:' + t.id, esc(t.emoji) + ' ' + esc(t.name)])).map(f => '<button class="chip ' + (filter === f[0] ? 'on' : '') + '" data-act="winFilter" data-v="' + f[0] + '">' + f[1] + '</button>').join('') + '</div>';

    const all = D.wins();
    const list = all.filter(w => filter === 'all' ||
      (filter.indexOf('tag:') === 0 ? (w.labels || []).indexOf(filter.slice(4)) >= 0 : filter === 'steps' ? ['step', 'stage', 'project'].includes(w.type) : w.tag === filter));
    const byDay = {};
    list.forEach(w => (byDay[w.date] = byDay[w.date] || []).push(w));
    Object.keys(byDay).sort().reverse().forEach(date => {
      const ds = new Date(date + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
      h += '<h2>' + (date === MP.today() ? 'Сегодня' : ds) + ' · ' + byDay[date].length + '</h2><div class="card">' +
        byDay[date].map(w =>
          '<div class="win"><span>' + (w.tag === 'assert' ? '💪' : w.tag === 'check' ? '🔍' : ICON[w.type] || '⭐') + '</span>' +
          '<div class="grow">' + esc(w.text) + '<div class="meta">' + D.winLabels(w).map(id => esc(MP.Store.get('tags', id).emoji) + ' ' + esc(MP.Store.get('tags', id).name)).join(' · ') + (D.winLabels(w).length && w.projectName ? ' · ' : '') + (w.projectName ? esc(w.projectName) : '') +
          (w.energyBefore ? ' · энергия ' + w.energyBefore + '→' + w.energyAfter : '') + (w.waveBefore ? ' · сила ' + w.waveBefore + '→' + w.waveAfter : '') + '</div></div>' +
          (w.type === 'manual' || w.type === 'step' ? '<button class="tagb ' + (w.tag === 'assert' ? 'on' : '') + '" aria-label="Отметить: отстояла себя" data-act="tagWin" data-id="' + w.id + '">💪</button>' : '') +
          '<button class="tagb ' + (D.winLabels(w).length ? 'on' : '') + '" aria-label="Метки победы" data-act="pickLabels" data-id="' + w.id + '">🏷</button>' +
          '<button class="tagb" aria-label="Удалить победу" data-act="delWin" data-id="' + w.id + '">🗑</button>' +
          '</div>').join('') + '</div>';
    });
    if (all.length && !list.length) h += '<div class="empty">Здесь пока пусто. Отметь 💪 у победы, где ты защитила себя.</div>';
    if (!all.length) h += '<div class="empty">Первая победа появится здесь, как только ты отметишь любую галочку.</div>';
    return h;
  };

  MP.acts.winFilter = el => { filter = el.dataset.v; MP.render(); };
  MP.acts.toggleManualAssert = el => { manualAssert = !manualAssert; el.classList.toggle('on', manualAssert); };
  MP.acts.addManualWin = form => {
    const text = form.elements.text.value.trim();
    if (!text) return;
    D.addManualWin(text, manualAssert, Array.from(manualLabels));
    const a = manualAssert;
    manualAssert = false;
    manualLabels.clear();
    MP.render();
    MP.burst(a ? 16 : 8);
    MP.toast(a ? 'Ты защитила себя. Это главное, чему ты учишься 💪' : MP.pick(MP.PRAISE));
  };
  MP.acts.toggleManualLabel = el => {
    const id = el.dataset.id;
    if (manualLabels.has(id)) manualLabels.delete(id); else manualLabels.add(id);
    el.classList.toggle('on', manualLabels.has(id));
  };

  // ---- метки победы (любой) ----
  MP.acts.pickLabels = el => {
    const w = MP.Store.get('wins', el.dataset.id), tags = D.tags();
    MP.openModal('<h3>🏷 Метки</h3><div class="hint">«' + esc(w.text) + '»</div>' +
      (tags.length
        ? '<div>' + tags.map(t => '<button type="button" class="chip ' + ((w.labels || []).indexOf(t.id) >= 0 ? 'on' : '') + '" data-act="toggleWinLabel" data-win="' + w.id + '" data-id="' + t.id + '">' + esc(t.emoji) + ' ' + esc(t.name) + '</button>').join('') + '</div>'
        : '<div class="empty">Своих меток пока нет. Создай первую — например, «Позаботилась о себе».</div>') +
      '<div class="row" style="margin-top:14px"><button class="btn ghost grow" data-act="manageTags">Свои метки…</button><button class="btn grow" data-act="doneLabels">Готово</button></div>');
  };
  MP.acts.toggleWinLabel = el => { const on = D.toggleLabel(el.dataset.win, el.dataset.id); el.classList.toggle('on', on); };
  MP.acts.doneLabels = () => { MP.closeModal(); MP.render(); };

  // ---- создание и удаление своих меток ----
  function tagsModal() {
    const tags = D.tags();
    MP.openModal('<h3>Свои метки</h3><div class="sub" style="margin-bottom:8px">Название и значок. Метку можно поставить на любую победу.</div>' +
      (tags.length ? '<div class="card">' + tags.map(t => '<div class="check"><span>' + esc(t.emoji) + '</span><div class="grow">' + esc(t.name) + '</div>' +
        '<button class="ic" aria-label="Удалить метку" data-act="delTag" data-id="' + t.id + '">🗑</button></div>').join('') + '</div>' : '') +
      '<form data-submit="saveTag"><div class="row"><input name="emoji" style="width:72px;text-align:center" maxlength="4" value="⭐" aria-label="Значок">' +
      '<input name="name" class="grow" required maxlength="40" placeholder="Например: Позаботилась о себе"></div>' +
      '<div class="row" style="margin-top:14px"><button type="button" class="btn ghost grow" data-act="closeModal">Закрыть</button><button type="submit" class="btn grow">Добавить метку</button></div></form>');
  }
  MP.acts.manageTags = () => tagsModal();
  MP.acts.saveTag = form => {
    const name = form.elements.name.value.trim();
    if (!name) return;
    D.addTag(name, form.elements.emoji.value.trim() || '⭐');
    tagsModal();
    MP.render();
  };
  MP.acts.delTag = el => {
    const list = D.deleteTag(el.dataset.id);
    MP.closeModal();
    MP.render();
    MP.undoToast('Метка убрана (у побед она скрыта)', list);
  };

  MP.acts.delWin = el => {
    const list = D.deleteWin(el.dataset.id);
    MP.render();
    MP.undoToast('Победа удалена', list);
  };

  MP.acts.tagWin = el => {
    const on = D.toggleAssert(el.dataset.id);
    MP.render();
    if (on) MP.toast('Отмечено: отстояла себя 💪');
  };
})();
