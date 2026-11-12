// Общие кусочки экрана, которые нужны и на «Сегодня», и на «Карте».
(function () {
  const MP = window.MP;
  const { esc } = MP;
  const D = MP.D;

  MP.BATT = ['', '🔋', '🔋🔋', '🔋🔋🔋'];

  // Кнопки выбора 1–N. group — имя группы, value — выбранное, act — что вызвать при нажатии
  MP.scaleButtons = (group, n, value, act) =>
    '<div class="energy" data-group="' + group + '">' +
    Array.from({ length: n }, (_, i) =>
      '<button type="button" class="' + (value === i + 1 ? 'on' : '') + '" data-act="' + act + '" data-group="' + group + '" data-v="' + (i + 1) + '">' + (i + 1) + '</button>'
    ).join('') + '</div>';

  // Переключить подсветку в группе, не перерисовывая окно (чтобы не потерять введённый текст)
  MP.paintGroup = (group, value) =>
    MP.$$('.energy[data-group="' + group + '"] button').forEach(b => b.classList.toggle('on', +b.dataset.v === value));

  MP.sphereSelect = (value, id = 'f-sph') =>
    '<select id="' + id + '">' + D.spheres().map(s => '<option value="' + s.id + '"' + (s.id === value ? ' selected' : '') + '>' + s.emoji + ' ' + esc(s.name) + '</option>').join('') + '</select>';

  // Строка шага. mode: 'today' | 'map'
  MP.stepRow = function (step, project, mode) {
    const today = mode === 'today';
    const actions = step.done ? '' :
      '<div class="actions">' +
      '<button class="ic ' + (step.inToday ? 'pinned' : '') + '" aria-label="Закрепить на сегодня" data-act="pinStep" data-id="' + step.id + '">⭐</button>' +
      '<button class="ic" aria-label="Разбить помельче" data-act="splitStep" data-id="' + step.id + '">✂️</button>' +
      (today ? '' : '<button class="ic" aria-label="Удалить шаг" data-act="delStep" data-id="' + step.id + '">🗑</button>') +
      '</div>';
    // мягкая подсказка — один раз и только для одного шага за раз
    const hint = MP.hintId === step.id && !step.done
      ? '<div class="stuck">Этот шаг, возможно, великоват. <button class="btn small ghost" data-act="splitStep" data-id="' + step.id + '">Разбить помельче</button> ' +
        '<button class="linkb" data-act="dismissHint" data-id="' + step.id + '">Оставить как есть</button></div>'
      : '';
    return '<div class="check ' + (step.done ? 'done' : '') + '">' +
      '<button class="dotbtn" aria-label="' + (step.done ? 'Снять отметку' : 'Отметить выполненным') + '" data-act="toggleStep" data-id="' + step.id + '"><span class="dot ' + (step.done ? 'on' : '') + '">' + (step.done ? '✓' : '') + '</span></button>' +
      '<div class="grow"><div class="txt">' + esc(step.text) + '</div>' +
      '<div class="meta">' + (today ? D.sphere(project.sphereId).emoji + ' ' + esc(project.name) + ' · ' : '') +
      (step.minutes ? step.minutes + ' мин · ' : '') + (MP.BATT[step.energy] || '') +
      (step.done && step.energyBefore ? ' · энергия ' + step.energyBefore + '→' + step.energyAfter : '') + '</div>' + hint + '</div>' +
      actions + '</div>';
  };

  // ---- «Разбить помельче» ----
  MP.acts.splitStep = el => {
    const f = D.findStep(el.dataset.id);
    if (!f) return;
    MP.openModal('<h3>✂️ Разбить помельче</h3><div class="hint">«' + esc(f.step.text) + '». Если шаг висит, он почти всегда просто великоват. Каждый новый шаг — с новой строки.</div>' +
      '<form data-submit="doSplit" data-id="' + f.step.id + '"><textarea name="lines" placeholder="Открыть…&#10;Написать 2 строки…&#10;Выбрать…"></textarea>' +
      '<div class="row" style="margin-top:18px"><button type="button" class="btn ghost grow" data-act="closeModal">Отмена</button><button type="submit" class="btn grow">Разбить</button></div></form>');
  };
  MP.acts.doSplit = form => {
    const n = D.splitStep(form.dataset.id, form.elements.lines.value.split('\n'));
    if (!n) return;
    MP.closeModal();
    MP.render();
    MP.toast('Готово. Теперь шаги по силам 🌿');
  };
  MP.acts.dismissHint = el => { D.dismissHint(el.dataset.id); MP.render(); };

  // ---- общие действия над шагами ----
  MP.acts.pinStep = el => {
    const on = D.pinStep(el.dataset.id);
    MP.render();
    MP.toast(on ? 'Добавлено в «Сегодня» ⭐' : 'Убрано из «Сегодня»');
  };

  MP.acts.delStep = el => {
    const list = D.deleteStep(el.dataset.id);
    MP.render();
    MP.undoToast('Шаг удалён', list);
  };

  // Нажали на кружок: если шаг не сделан — спрашиваем энергию до/после (можно пропустить)
  let pend = {};
  MP.acts.toggleStep = el => {
    const f = D.findStep(el.dataset.id);
    if (!f) return;
    if (f.step.done) {
      const status = D.uncompleteStep(f.step.id);
      MP.render();
      if (status === 'active') MP.toast('Проект «' + f.project.name + '» снова в работе');
      else if (status === 'queue') MP.toast('Проект «' + f.project.name + '» вернулся в очередь: в работе уже ' + D.MAX_ACTIVE + '. Это не отказ, а «не сейчас»');
      return;
    }
    pend = { id: f.step.id, eb: D.dayEnergy() || 0, ea: 0 };
    MP.openModal(
      '<h3>✓ ' + esc(f.step.text) + '</h3>' +
      '<div class="hint">Отметить энергию можно, а можно и пропустить — шаг засчитается в любом случае.</div>' +
      '<label>Энергия до шага</label>' + MP.scaleButtons('eb', 5, pend.eb, 'pickEnergy') +
      '<label>Энергия после шага</label>' + MP.scaleButtons('ea', 5, 0, 'pickEnergy') +
      '<div class="row" style="margin-top:18px"><button class="btn ghost grow" data-act="finishStep" data-skip="1">Пропустить</button>' +
      '<button class="btn grow" data-act="finishStep">Готово 🌿</button></div>'
    );
  };
  MP.acts.pickEnergy = el => { pend[el.dataset.group] = +el.dataset.v; MP.paintGroup(el.dataset.group, +el.dataset.v); };

  MP.acts.finishStep = el => {
    const res = D.completeStep(pend.id);
    if (!res) return MP.closeModal();
    if (!el.dataset.skip) D.setStepEnergy(pend.id, pend.eb, pend.ea);
    MP.closeModal();
    MP.render();
    if (res.stageClosed) { MP.burst(res.projectDone ? 30 : 22); MP.toast(res.projectDone ? 'Проект «' + res.projectName + '» завершён! 🏆' : MP.pick(MP.STAGE_PRAISE)); }
    else { MP.burst(8); MP.toast(MP.pick(MP.PRAISE)); }
  };
})();
