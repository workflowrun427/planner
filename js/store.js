// Хранилище. Всё лежит в localStorage одним JSON под ключом mypath-data.
// Правила: у каждой записи есть id, createdAt, updatedAt, deletedAt.
// Удаление «мягкое»: запись остаётся с deletedAt, но скрыта. Так её можно вернуть,
// а синхронизация потом не воскресит удалённое.
(function () {
  const MP = window.MP;
  const KEY = 'mypath-data';
  const BACKUP_KEY = 'mypath-backup';
  const CORRUPT_KEY = 'mypath-corrupt';
  const EPOCH = '2000-01-01T00:00:00.000Z';

  MP.COLLECTIONS = ['spheres', 'projects', 'stages', 'steps', 'anchors', 'anchorLogs', 'days', 'wins', 'waves', 'deposits', 'tags'];

  const Store = (MP.Store = { VERSION: 1, saveError: false, loadProblem: null });
  let data = null;

  function normalizeData(d) {
    if (!d || typeof d !== 'object') throw new Error('нет данных');
    const out = MP.emptyData();
    MP.COLLECTIONS.forEach(c => {
      const list = Array.isArray(d[c]) ? d[c] : [];
      list.forEach(r => {
        if (!r || typeof r !== 'object' || r.id == null || r.id === '') return;
        out[c].push(Object.assign({}, r, {
          id: String(r.id),
          createdAt: r.createdAt || EPOCH,
          updatedAt: r.updatedAt || r.createdAt || EPOCH,
          deletedAt: r.deletedAt || null
        }));
      });
    });
    return out;
  }

  Store.load = function () {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { Store.saveError = true; }
    if (raw == null) {
      data = MP.seed();
      Store.save();
      Store.noteFirstRun();
      return 'new';
    }
    try {
      data = normalizeData(JSON.parse(raw).data);
      return 'ok';
    } catch (e) {
      // Данные не читаются: сохраняем «как есть» в отдельный ключ и не теряем
      try { localStorage.setItem(CORRUPT_KEY, raw); } catch (_) {}
      Store.loadProblem = 'Не удалось прочитать сохранённые данные. Копия лежит в памяти браузера (mypath-corrupt), приложение начато заново.';
      data = MP.seed();
      Store.save();
      return 'corrupt';
    }
  };

  Store.save = function () {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: Store.VERSION, data }));
      Store.saveError = false;
    } catch (e) {
      Store.saveError = true;
    }
  };

  const find = (c, id) => data[c].find(r => r.id === id);

  Store.get = (c, id) => find(c, id);
  Store.live = c => data[c].filter(r => !r.deletedAt);
  Store.all = () => data;

  Store.add = function (c, fields) {
    const now = MP.nowIso();
    const rec = Object.assign({ id: MP.uid() }, fields, { createdAt: now, updatedAt: now, deletedAt: null });
    data[c].push(rec);
    Store.save();
    return rec;
  };

  Store.update = function (c, id, patch) {
    const r = find(c, id);
    if (!r) return null;
    Object.assign(r, patch, { updatedAt: MP.nowIso() });
    Store.save();
    return r;
  };

  // Создать запись с известным id или обновить и «оживить» существующую
  Store.upsert = function (c, id, fields) {
    const r = find(c, id);
    if (r) return Store.update(c, id, Object.assign({}, fields, { deletedAt: null }));
    return Store.add(c, Object.assign({}, fields, { id }));
  };

  Store.remove = function (c, id) {
    const r = find(c, id);
    if (!r || r.deletedAt) return null;
    const now = MP.nowIso();
    r.deletedAt = now;
    r.updatedAt = now;
    Store.save();
    return r;
  };

  Store.restore = function (c, id) {
    const r = find(c, id);
    if (!r) return null;
    r.deletedAt = null;
    r.updatedAt = MP.nowIso();
    Store.save();
    return r;
  };

  // ---- экспорт / импорт / слияние ----
  // Заметки из «Поддержки» попадают в файл только если человек сам этого захотел
  Store.exportObject = function (includeNotes) {
    const out = { app: 'mypath', version: Store.VERSION, exportedAt: MP.nowIso(), data: JSON.parse(JSON.stringify(data)) };
    if (includeNotes) out.privateNotes = Store.notes.all();
    return out;
  };

  // Служебные отметки (хранятся отдельно, не входят в данные): когда сохраняли копию и когда начали вести данные
  const META_KEY = 'mypath-meta';
  const readMeta = () => { try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch (e) { return {}; } };
  const writeMeta = patch => { try { localStorage.setItem(META_KEY, JSON.stringify(Object.assign(readMeta(), patch))); } catch (e) {} };
  Store.lastExportAt = () => readMeta().lastExportAt || null;
  Store.markExported = () => writeMeta({ lastExportAt: MP.nowIso() });
  // Дата первого запуска на этом устройстве: если она вдруг «сбросилась», значит, данные пропали
  Store.firstRunAt = () => readMeta().firstRunAt || null;
  Store.lastSyncAt = () => readMeta().lastSyncAt || null;
  Store.markSynced = () => writeMeta({ lastSyncAt: MP.nowIso() });
  Store.noteFirstRun = () => { if (!readMeta().firstRunAt) writeMeta({ firstRunAt: MP.nowIso() }); };

  Store.parseImport = function (text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { throw new Error('Файл не читается: это не копия данных.'); }
    if (!obj || typeof obj !== 'object') throw new Error('Файл не похож на копию данных.');
    if (obj.version !== undefined) {
      if (typeof obj.version !== 'number') throw new Error('В файле странное поле version.');
      if (obj.version > Store.VERSION) throw new Error('Копия сделана более новой версией приложения. Обнови приложение и попробуй снова.');
      const notes = obj.privateNotes && typeof obj.privateNotes === 'object' && !Array.isArray(obj.privateNotes) ? obj.privateNotes : null;
      return { kind: 'v' + obj.version, data: normalizeData(obj.data), notes, exportedAt: obj.exportedAt || null };
    }
    if (Array.isArray(obj.projects)) {
      const m = MP.migrateLegacy(obj);
      return { kind: 'prototype', data: normalizeData(m.data), notes: m.notes, exportedAt: null };
    }
    throw new Error('Файл не похож на копию данных этого приложения.');
  };

  // Какая версия записи главнее: изменённая позже. При полной ничьей (одно и то же время) — удалённая, а если и это равно,
  // то выбирается по тексту записи: так оба устройства придут к одному и тому же результату, а не останутся каждое при своём.
  const newer = (a, b) => {
    if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt;
    if (!!a.deletedAt !== !!b.deletedAt) return !!a.deletedAt;
    return JSON.stringify(a) > JSON.stringify(b);
  };

  Store.merge = function (incoming) {
    let added = 0, updated = 0;
    // страховка: перед объединением кладём текущие данные в запасную копию (её можно вернуть в «Ещё»)
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify({ savedAt: MP.nowIso(), version: Store.VERSION, data })); } catch (e) {}
    MP.COLLECTIONS.forEach(c => {
      const local = new Map(data[c].map(r => [r.id, r]));
      incoming[c].forEach(r => {
        const mine = local.get(r.id);
        if (!mine) { data[c].push(r); added++; }
        else if (newer(r, mine)) { data[c][data[c].indexOf(mine)] = r; updated++; }
      });
    });
    Store.save();
    return { added, updated };
  };

  // Перед заменой всё текущее откладывается в резервную копию внутри браузера
  Store.replaceAll = function (incoming) {
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify({ savedAt: MP.nowIso(), version: Store.VERSION, data })); } catch (e) {}
    data = incoming;
    Store.save();
  };

  Store.backupInfo = function () {
    try {
      const b = JSON.parse(localStorage.getItem(BACKUP_KEY));
      return b && b.data ? { savedAt: b.savedAt } : null;
    } catch (e) { return null; }
  };

  // «Отменить последнюю замену»: возвращает данные из резервной копии (а текущие сами становятся резервной копией)
  Store.restoreBackup = function () {
    const b = JSON.parse(localStorage.getItem(BACKUP_KEY));
    Store.replaceAll(normalizeData(b.data));
  };

  // Слить заметки из файла (существующие заметки не затираем)
  Store.mergeNotes = function (incoming) {
    if (!incoming) return 0;
    let n = 0;
    Object.keys(incoming).forEach(id => {
      if (Array.isArray(incoming[id]) && incoming[id].length && !Store.notes.get(id).length) { Store.notes.set(id, incoming[id].map(String)); n++; }
    });
    return n;
  };

  // ---- личные заметки из «Поддержки» ----
  // Лежат в отдельном ключе, не входят в основные данные: не попадают в синхронизацию,
  // а в файл экспорта — только если человек сам поставит галочку.
  const NOTES_KEY = 'mypath-private';
  const readNotes = () => { try { return JSON.parse(localStorage.getItem(NOTES_KEY)) || {}; } catch (e) { return {}; } };
  Store.notes = {
    get: id => readNotes()[id] || [],
    set(id, list) {
      const all = readNotes();
      if (list.length) all[id] = list; else delete all[id];
      try { localStorage.setItem(NOTES_KEY, JSON.stringify(all)); } catch (e) { Store.saveError = true; }
    },
    all: readNotes,
    count: () => Object.keys(readNotes()).length,
    clear() { try { localStorage.removeItem(NOTES_KEY); } catch (e) {} }
  };

  Store.reset = function () { // для тестов
    data = MP.seed();
    Store.save();
  };
})();
