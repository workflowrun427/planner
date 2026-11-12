// Перенос данных из прототипа (старый формат без поля version) в новый формат.
(function () {
  const MP = window.MP;

  const iso = ts => (ts ? new Date(ts).toISOString() : '2000-01-01T00:00:00.000Z');
  const stamps = ts => ({ createdAt: iso(ts), updatedAt: iso(ts), deletedAt: null });

  MP.migrateLegacy = function (S) {
    const d = MP.emptyData();
    const ok = x => x && typeof x === 'object';

    MP.SPHERE_DEFS.forEach((s, i) => d.spheres.push(Object.assign({ id: s.id, name: s.name, emoji: s.emoji, order: i }, stamps(0))));

    (S.anchors || []).filter(ok).forEach((a, i) =>
      d.anchors.push(Object.assign({ id: String(a.id), text: a.text, sphereId: a.sphere || 'health', order: i }, stamps(0)))
    );

    Object.entries(S.days || {}).forEach(([date, v]) => {
      if (!ok(v)) return;
      d.days.push(Object.assign({ id: date, date, energy: v.energy || 0 }, stamps(Date.parse(date + 'T12:00'))));
      (v.anchors || []).forEach(aid =>
        d.anchorLogs.push(Object.assign({ id: date + ':' + aid, date, anchorId: String(aid) }, stamps(Date.parse(date + 'T12:00'))))
      );
    });

    (S.projects || []).filter(ok).forEach(p => {
      const pid = String(p.id);
      d.projects.push(
        Object.assign(
          { id: pid, name: p.name, sphereId: p.sphere || 'mine', status: p.status || 'queue', hasSavings: !!p.savings, savingsTarget: (p.savings && p.savings.target) || 0 },
          stamps(0)
        )
      );
      (p.stages || []).forEach((st, si) => {
        d.stages.push(Object.assign({ id: String(st.id), projectId: pid, name: st.name, order: si }, stamps(0)));
        (st.steps || []).forEach((s, i) =>
          d.steps.push(
            Object.assign(
              {
                id: String(s.id), stageId: String(st.id), text: s.text, minutes: s.min || 0, energy: s.en || 1,
                done: !!s.done, doneAt: s.doneAt ? iso(s.doneAt) : null, inToday: !!s.today,
                energyBefore: s.eb || null, energyAfter: s.ea || null, order: i,
                bigHintShown: true // чтобы после переноса не посыпались подсказки про «великоват»
              },
              stamps(s.created)
            )
          )
        );
      });
      // id отметки выводим из проекта и времени: повторная загрузка той же копии не создаёт дублей
      ((p.savings && p.savings.deposits) || []).forEach((dep, di) =>
        d.deposits.push(Object.assign({ id: 'legacy-dep-' + pid + '-' + (dep.ts || di), projectId: pid, amount: dep.amount, date: MP.dateStr(new Date(dep.ts || Date.now())) }, stamps(dep.ts)))
      );
    });

    (S.wins || []).filter(ok).forEach(w =>
      d.wins.push(
        Object.assign(
          {
            id: String(w.id), date: w.date, type: w.type || 'manual', tag: w.tag || null, text: w.text,
            refId: w.step || w.anchor || null, projectName: w.proj || null,
            energyBefore: w.eb || null, energyAfter: w.ea || null, waveBefore: w.sb || null, waveAfter: w.sa || null
          },
          stamps(w.ts)
        )
      )
    );

    // Заметки из «Поддержки» не кладём в основные данные: возвращаем отдельно (они останутся только на устройстве)
    const notes = {};
    (S.waves || []).filter(ok).forEach(w => {
      d.waves.push(Object.assign({ id: String(w.id), date: w.date, kind: w.kind, what: w.what || '', before: w.b || 0, after: w.a || 0 }, stamps(w.ts)));
      if (Array.isArray(w.notes) && w.notes.length) notes[String(w.id)] = w.notes.map(String);
    });
    return { data: d, notes: Object.keys(notes).length ? notes : null };
  };
})();
