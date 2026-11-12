// Синхронизация между устройствами через файл в iCloud Drive.
// Приложение не может само читать iCloud, поэтому обмен идёт через один файл mypath-sync.json:
//  «Отдать» — сохраняет свежий файл; «Синхронизировать» — берёт файл с другого устройства, объединяет и предлагает сохранить обновлённый.
// Объединение безопасно: берётся запись, изменённая позже; удалённое не возвращается; заметки из «Поддержки» в файл не попадают.
(function () {
  const MP = window.MP;
  const SYNC_NAME = 'mypath-sync.json';

  // Сохранить файл: на iPhone (в установленном приложении) — через меню «Поделиться» → «Сохранить в Файлы», иначе обычная загрузка
  MP.saveFile = function (text, name, onDone, doneMsg) {
    try {
      const file = new File([text], name, { type: 'application/json' });
      if (MP.isStandalone() && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: name })
          .then(() => onDone(doneMsg))
          .catch(e => { if (e && e.name !== 'AbortError') MP.toast('Не получилось сохранить файл. Попробуй «скопировать копию как текст» ниже.'); });
        return;
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      onDone('Файл ' + name + ' сохранён (папка «Загрузки» или та, что выбрана в настройках Safari)');
    } catch (e) {
      MP.toast('Не получилось создать файл. Попробуй «скопировать копию как текст» ниже.');
    }
  };

  MP.syncCard = function () {
    const last = MP.Store.lastSyncAt();
    const when = last ? new Date(last).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : null;
    return '<h2>Синхронизация (iCloud)</h2><div class="card">' +
      '<div class="sub">Телефон и компьютер обмениваются одним файлом через iCloud Drive. Без аккаунтов и серверов. Заметки из «Поддержки» в файл не попадают.</div>' +
      '<div class="meta" style="margin:8px 0">' + (when ? 'Последний обмен на этом устройстве: ' + when : 'Обмена ещё не было.') + '</div>' +
      '<div class="row wrapr"><button class="btn small" data-act="syncPick">🔄 Синхронизировать</button>' +
      '<button class="btn small ghost" data-act="syncSave">⬆ Только отдать</button></div>' +
      '<input type="file" id="f-sync" accept=".json,application/json" hidden>' +
      '<details style="margin-top:10px"><summary><span class="linkb">Как это работает ▾</span></summary><ol class="steps">' +
      '<li><b>Один раз.</b> Включи iCloud Drive на айфоне и на Маке. На Маке: Safari → Настройки → Основные → «Место для загрузки файлов» → выбери папку в iCloud Drive (например, «Мой путь»).</li>' +
      '<li><b>Закончила работать на одном устройстве:</b> нажми «Только отдать». На айфоне выбери «Сохранить в Файлы» → iCloud Drive → папка «Мой путь» (если спросит, «Заменить»).</li>' +
      '<li><b>Села за другое устройство:</b> нажми «Синхронизировать» и выбери файл <b>mypath-sync.json</b> из iCloud Drive. Данные объединятся, ничего не потеряется.</li>' +
      '<li>После этого приложение предложит сохранить обновлённый файл — согласись, чтобы другое устройство тоже получило всё.</li>' +
      '<li>На Маке повторные файлы могут называться «mypath-sync 2.json» — бери самый свежий.</li></ol></details></div>';
  };

  MP.acts.syncPick = () => MP.$('#f-sync').click();

  document.addEventListener('change', e => {
    if (e.target.id !== 'f-sync') return;
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { e.target.value = ''; return MP.toast('Файл слишком большой для копии данных.'); }
    const r = new FileReader();
    r.onload = () => MP.syncFromText(String(r.result));
    r.onerror = () => MP.toast('Не получилось прочитать файл.');
    r.readAsText(f);
    e.target.value = '';
  });

  // Объединить данные из текста файла и предложить сохранить обновлённый
  MP.syncFromText = function (text) {
    let res;
    try { res = MP.Store.parseImport(text); } catch (err) { return MP.toast(err.message); }
    const r = MP.Store.merge(res.data); // перед объединением приложение само откладывает запасную копию
    MP.Store.markSynced();
    MP.render();
    MP.openModal('<h3>Готово 🌿</h3><div class="hint">Объединено: новых записей <b>' + r.added + '</b>, обновлено <b>' + r.updated + '</b>. ' +
      'Теперь сохрани обновлённый файл в iCloud, чтобы другое устройство тоже получило всё.</div>' +
      '<div class="row" style="margin-top:14px"><button class="btn ghost grow" data-act="closeModal">Позже</button><button class="btn grow" data-act="syncSave">Сохранить в iCloud</button></div>');
  };

  MP.acts.syncSave = () => {
    const text = JSON.stringify(MP.Store.exportObject(false), null, 2);
    MP.closeModal();
    MP.saveFile(text, SYNC_NAME, msg => { MP.Store.markSynced(); MP.render(); MP.toast(msg); }, 'Файл сохранён 💛 Теперь открой его на другом устройстве');
  };
})();
