// Экран «Победы»: журнал всего, что сделано, по дням.
(function () {
  const MP = window.MP;
  const { esc } = MP;
  const D = MP.D;

  let filter = 'all';
  let manualAssert = false;

  const FILTERS = [['all', 'Все'], ['assert', '💪 Отстояла себя'], ['wave', '🌊 Волны'], ['check', '🔍 Проверила'], ['save', '🪙 Накопления'], ['steps', '👣 Шаги']];
  const ICON = { step: '👣', stage: '✅', project: '🏆', anchor: '🌱', manual: '💛', save: '🪙', wave: '🌊' };
  const stat = (n, label) => '<div class="stat"><b>' + n + '</b><span class="meta">' + label + '</span></div>';

  MP.views.wins = function () {
    const st = D.winStats();
    const d = st.energyDelta;
    let h = '<h1>🌿 Журнал побед</h1><div class="sub">Всё, что ты сделала. Доказательство, когда критик говорит обратное.</div>' +
      '<div class="row" style="margin:16px 0">' + stat(st.week, 'за 7 дней') + stat(st.total, 'всего') +
      stat(d === null ? '—' : st.energyBeforeAvg.toFixed(1) + '→' + st.energyAfterAvg.toFixed(1), 'энергия до → после дел') + '</div>';
    if (d !== null && d > 0) h += '<div class="hint">В среднем после дела энергии становится <b>больше</b> (по ' + st.energyCount + ' отметкам). Действие даёт силы, а не только забирает их.</div>';
    else if (d === null) h += '<div class="hint">Когда будешь отмечать энергию до и после шагов, здесь появится, как она меняется после дел.</div>';

    h += '<div class="card"><form data-submit="addManualWin"><div class="row"><input name="text" class="grow" maxlength="200" placeholder="Своя победа: например, «сказала, что мне неудобно»" required>' +
      '<button class="btn" type="submit" aria-label="Добавить победу">+</button></div>' +
      '<div style="margin-top:8px"><button type="button" class="chip ' + (manualAssert ? 'on' : '') + '" data-act="toggleManualAssert">💪 Отстояла себя</button></div></form></div>';

    h += '<div>' + FILTERS.map(f => '<button class="chip ' + (filter === f[0] ? 'on' : '') + '" data-act="winFilter" data-v="' + f[0] + '">' + f[1] + '</button>').join('') + '</div>';

    const all = D.wins();
    const list = all.filter(w => filter === 'all' || (filter === 'steps' ? ['step', 'stage', 'project'].includes(w.type) : w.tag === filter));
    const byDay = {};
    list.forEach(w => (byDay[w.date] = byDay[w.date] || []).push(w));
    Object.keys(byDay).sort().reverse().forEach(date => {
      const ds = new Date(date + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
      h += '<h2>' + (date === MP.today() ? 'Сегодня' : ds) + ' · ' + byDay[date].length + '</h2><div class="card">' +
        byDay[date].map(w =>
          '<div class="win"><span>' + (w.tag === 'assert' ? '💪' : w.tag === 'check' ? '🔍' : ICON[w.type] || '⭐') + '</span>' +
          '<div class="grow">' + esc(w.text) + '<div class="meta">' + (w.projectName ? esc(w.projectName) : '') +
          (w.energyBefore ? ' · энергия ' + w.energyBefore + '→' + w.energyAfter : '') + (w.waveBefore ? ' · сила ' + w.waveBefore + '→' + w.waveAfter : '') + '</div></div>' +
          (w.type === 'manual' || w.type === 'step' ? '<button class="tagb ' + (w.tag === 'assert' ? 'on' : '') + '" aria-label="Отметить: отстояла себя" data-act="tagWin" data-id="' + w.id + '">💪</button>' : '') +
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
    D.addManualWin(text, manualAssert);
    const a = manualAssert;
    manualAssert = false;
    MP.render();
    MP.burst(a ? 16 : 8);
    MP.toast(a ? 'Ты защитила себя. Это главное, чему ты учишься 💪' : MP.pick(MP.PRAISE));
  };
  MP.acts.tagWin = el => {
    const on = D.toggleAssert(el.dataset.id);
    MP.render();
    if (on) MP.toast('Отмечено: отстояла себя 💪');
  };
})();
