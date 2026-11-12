// Общие кусочки интерфейса: всплывающие подсказки, окна, анимация, обработка нажатий.
(function () {
  const MP = window.MP;
  const { $, esc, pick } = MP;

  MP.PRAISE = [
    'Ты молодец 💛', 'Шаг сделан — это и есть движение', 'Маленький шаг, настоящая победа',
    'Вот так и растёт накопительный эффект', 'Засчитано! Ты делаешь это для себя',
    'Ещё один кирпичик в твою опору', 'Горжусь тобой 🌿'
  ];
  MP.STAGE_PRAISE = ['Этап закрыт! 🎉 Ты довела это до конца', 'Целый этап позади — запомни это чувство 🎉'];

  const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- всплывающая подсказка (необязательно с кнопкой, например «Вернуть») ----
  let toastTimer = null, toastAction = null;
  MP.toast = function (text, action) {
    const el = $('#toast');
    toastAction = action ? action.onClick : null;
    el.innerHTML = esc(text) + (action ? ' <button class="toast-btn" data-act="toastAction">' + esc(action.label) + '</button>' : '');
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), action ? 7000 : 2800);
  };
  MP.acts.toastAction = () => {
    const fn = toastAction;
    toastAction = null;
    $('#toast').classList.remove('show');
    if (fn) fn();
  };

  // ---- маленький праздник ----
  MP.burst = function (n = 12) {
    if (reduceMotion()) return;
    const em = ['✨', '🌿', '💛', '🎉', '⭐'];
    for (let i = 0; i < n; i++) {
      const b = document.createElement('div');
      b.className = 'burst';
      b.textContent = em[i % em.length];
      b.style.left = window.innerWidth / 2 + 'px';
      b.style.top = window.innerHeight / 2 + 'px';
      b.style.setProperty('--dx', Math.random() * 300 - 150 + 'px');
      b.style.setProperty('--dy', Math.random() * -300 - 40 + 'px');
      document.body.appendChild(b);
      setTimeout(() => b.remove(), 1300);
    }
  };

  // ---- окна (выезжают снизу) ----
  MP.onModalClose = null; // чтобы окно могло остановить таймер и т. п.
  MP.openModal = function (html) {
    $('#modal').innerHTML = html;
    $('#mbg').classList.add('show');
    document.body.classList.add('modal-open');
    $('#modal').scrollTop = 0;
  };
  MP.closeModal = function () {
    if (MP.onModalClose) { const f = MP.onModalClose; MP.onModalClose = null; f(); }
    $('#mbg').classList.remove('show');
    document.body.classList.remove('modal-open');
  };
  MP.modalOpen = () => $('#mbg').classList.contains('show');
  MP.acts.closeModal = MP.closeModal;

  let confirmFn = null;
  MP.confirmBox = function (text, onYes, yesLabel) {
    confirmFn = onYes;
    MP.openModal(
      '<h3>' + esc(text) + '</h3><div class="row" style="margin-top:18px">' +
      '<button class="btn ghost grow" data-act="closeModal">Нет</button>' +
      '<button class="btn warm grow" data-act="confirmYes">' + esc(yesLabel || 'Да') + '</button></div>'
    );
  };
  MP.acts.confirmYes = () => { const f = confirmFn; confirmFn = null; MP.closeModal(); if (f) f(); };

  // Удалили → «Вернуть» (удаление мягкое, поэтому вернуть можно)
  MP.undoToast = function (text, list) {
    MP.toast(text, { label: 'Вернуть', onClick: () => { MP.D.restore(list); MP.render(); } });
  };

  // ---- обработка нажатий: любой элемент с data-act="имя" вызывает MP.acts[имя] ----
  document.addEventListener('click', e => {
    if (e.target.id === 'mbg') return MP.closeModal();
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = MP.acts[el.dataset.act];
    if (fn) fn(el, e);
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-submit]');
    if (!f) return;
    e.preventDefault();
    const fn = MP.acts[f.dataset.submit];
    if (fn) fn(f, e);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && MP.modalOpen()) MP.closeModal(); });
})();
