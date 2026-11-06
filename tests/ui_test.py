#!/usr/bin/env python3
"""Проверка приложения «руками» через Safari (safaridriver): нажимает кнопки, печатает текст, делает скриншоты.
Запуск: python3 tests/ui_test.py   (нужно: Safari → Настройки → Разработка → «Разрешить удалённую автоматизацию»)
Все данные вымышленные. Сайт поднимается локально и закрывается по окончании."""
import base64, json, os, subprocess, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = '/tmp/mypath-shots'
DRV = 'http://127.0.0.1:4444'
SITE = 'http://127.0.0.1:8765/index.html'
os.makedirs(SHOTS, exist_ok=True)
EL = 'element-6066-11e4-a52e-4f735466cecf'
fails, total = [], 0


def call(method, path, body=None):
    req = urllib.request.Request(DRV + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())['value']
    except urllib.error.HTTPError as e:
        return {'error': json.loads(e.read())['value']}


sid = None
def S(path): return '/session/%s%s' % (sid, path)
def js(script, *args):
    r = call('POST', S('/execute/sync'), {'script': script, 'args': list(args)})
    if isinstance(r, dict) and 'error' in r: raise RuntimeError('JS: %s' % r['error'])
    return r
def find(css):
    r = call('POST', S('/element'), {'using': 'css selector', 'value': css})
    if isinstance(r, dict) and 'error' in r: raise RuntimeError('нет элемента: ' + css)
    return r[EL]
def click(css, pause=0.35):
    e = find(css)
    # как человек: сначала прокручиваем нужное в середину экрана (иначе нижняя панель может перекрыть кнопку)
    js("arguments[0].scrollIntoView({block:'center'})", {EL: e})
    time.sleep(0.15)
    call('POST', S('/element/%s/click' % e))
    time.sleep(pause)
def typ(css, text, clear=True):
    e = find(css)
    if clear: call('POST', S('/element/%s/clear' % e))
    call('POST', S('/element/%s/value' % e), {'text': text})
def check(name, cond):
    global total
    total += 1
    print(('  ok   ' if cond else '  FAIL ') + name)
    if not cond: fails.append(name)
def shot(name):
    png = call('GET', S('/screenshot'))
    open('%s/%s.png' % (SHOTS, name), 'wb').write(base64.b64decode(png))
def nav(v): click('.nav button[data-v=%s]' % v)
def section(t): print(t)


server = subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '--bind', '127.0.0.1', '--directory', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
driver = subprocess.Popen(['safaridriver', '-p', '4444'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(2)
try:
    r = call('POST', '/session', {'capabilities': {'alwaysMatch': {'browserName': 'safari'}}})
    if 'error' in r: sys.exit('Не удалось начать сессию: ' + str(r))
    sid = r['sessionId']
    call('POST', S('/window/rect'), {'width': 430, 'height': 900})
    call('POST', S('/url'), {'url': SITE}); time.sleep(1.5)
    js("window.__errs=[];window.addEventListener('error',function(e){window.__errs.push(e.message+' @'+(e.filename||'').split('/').pop()+':'+e.lineno)});window.addEventListener('unhandledrejection',function(e){window.__errs.push('promise: '+e.reason)})")

    section('Запуск')
    check('приложение загрузилось (MP есть, экран не пустой)', js("return !!window.MP && document.querySelector('#app').innerText.length>20"))
    check('все обработчики на месте (≥ 40)', js("return Object.keys(MP.acts).length") >= 40)
    check('5 вкладок', js("return document.querySelectorAll('.nav button').length") == 5)
    check('начальные данные: 4 опоры', js("return document.querySelectorAll('[data-act=toggleAnchor]').length") == 4)
    shot('01-today')

    section('Сегодня')
    check('без энергии показан 1 лёгкий шаг', js("return document.querySelectorAll('#app [data-act=toggleStep]').length") == 1)
    click('.energy[data-group=day] button[data-v="5"]')
    check('энергия 5 выбрана', js("return MP.D.dayEnergy()") == 5)
    click('[data-act=toggleAnchor]')
    check('опора отмечена', js("return MP.D.anchorDone(MP.D.anchors()[0].id)"))
    click('#app [data-act=toggleStep]')
    check('открылось окно с энергией до/после', js("return MP.modalOpen()"))
    shot('02-step-modal')
    click('#modal .energy[data-group=ea] button[data-v="4"]')
    click('#modal [data-act=finishStep]:not([data-skip])', 0.5)
    check('шаг выполнен, окно закрылось, победа записана', not js("return MP.modalOpen()") and js("return MP.D.wins().some(function(w){return w.type==='step'})"))
    check('появилась тёплая фраза', js("return document.querySelector('#toast').classList.contains('show')"))
    check('энергия «после» сохранилась', js("return MP.D.wins().filter(function(w){return w.type==='step'})[0].energyAfter") == 4)

    section('Карта: проект, накопления, этап, шаг')
    nav('map')
    click('[data-act=newProject]')
    typ('#modal input[name=name]', 'Тестовая копилка')
    click('#modal input[name=savings]')
    typ('#modal input[name=target]', '1000')
    click('#modal button[type=submit]')
    pid = js("var p=MP.D.projects().filter(function(p){return p.name==='Тестовая копилка'})[0];return p&&p.id")
    check('проект создан с накоплением и целью', js("var p=MP.D.project(arguments[0]);return p.hasSavings===true&&p.savingsTarget===1000", pid))
    click('[data-act=newStage]')
    typ('#modal input[name=name]', 'Этап 1')
    click('#modal button[type=submit]')
    click('[data-act=newStep]')
    typ('#modal input[name=text]', 'Сделать большое дело')
    typ('#modal input[name=minutes]', '40')
    click('#modal .energy[data-group=sen] button[data-v="2"]')
    click('#modal button[type=submit]', 0.5)
    check('шаг на 40 минут создан, предложено разбить', js("return !!document.querySelector('#toast.show .toast-btn')"))
    shot('03-map')
    click('#toast .toast-btn')
    typ('#modal textarea[name=lines]', 'Открыть файл\nНаписать две строки\nСохранить')
    click('#modal button[type=submit]')
    stage = js("return MP.D.stages(arguments[0])[0].id", pid)
    check('разбит на 3 шага, большой скрыт', js("return MP.D.steps(arguments[0]).map(function(s){return s.text}).join('|')", stage) == 'Открыть файл|Написать две строки|Сохранить')
    click('[data-act=newDeposit]')
    typ('#modal input[name=amount]', '250')
    click('#modal button[type=submit]')
    check('отложено 250', js("return MP.D.saved(arguments[0])", pid) == 250)
    click('[data-act=newDeposit]'); typ('#modal input[name=amount]', '100'); click('#modal button[type=submit]', 0.5)
    check('350 из 1000 — новой границы нет, обычная фраза без процентов', '%' not in js("return document.querySelector('#toast').innerText"))
    click('[data-act=newDeposit]'); typ('#modal input[name=amount]', '150'); click('#modal button[type=submit]', 0.5)
    check('500 из 1000 — поздравление про 50%', '50%' in js("return document.querySelector('#toast').innerText"))
    shot('04-savings')
    click('[data-act=editDeposit]')
    typ('#modal input[name=amount]', '200')
    click('#modal button[type=submit]')
    check('отметку можно исправить (самая новая 150 → 200: итого 550)', js("return MP.D.saved(arguments[0])", pid) == 550)
    click('[data-act=delDeposit]', 0.5)
    check('отметку можно удалить', js("return MP.D.deposits(arguments[0]).length", pid) == 2)
    click('#toast .toast-btn')
    check('«Вернуть» возвращает отметку', js("return MP.D.deposits(arguments[0]).length", pid) == 3)

    section('Закрытие этапа и проекта, снятие отметки')
    for _ in range(3):
        click('#app .card .check:not(.done) [data-act=toggleStep]'); click('#modal [data-act=finishStep][data-skip="1"]', 0.5)
    check('проект завершён', js("return MP.D.project(arguments[0]).status", pid) == 'done')
    check('записаны победы за этап и проект', js("var t=MP.D.wins().map(function(w){return w.type});return t.indexOf('stage')>=0&&t.indexOf('project')>=0"))
    shot('05-project-done')
    undone = js("return MP.D.steps(arguments[0])[0].id", stage)
    click('#app details:nth-of-type(2) summary')   # раскрыть «Завершённые», как человек
    click('[data-act=toggleStep][data-id="%s"]' % undone, 0.5)
    check('снятие отметки возвращает проект «в работу» (места есть)', js("return MP.D.project(arguments[0]).status", pid) == 'active')

    section('Лимит активных проектов')
    for n in range(4):
        click('[data-act=newProject]'); typ('#modal input[name=name]', 'Проект %d' % n); click('#modal button[type=submit]', 0.3)
    check('активных не больше 3', js("return MP.D.activeCount()") <= 3)
    check('остальные в очереди', js("return MP.D.projects('queue').length") >= 1)
    q = js("return MP.D.projects('queue')[0].id")
    r_ = js("return MP.D.setStatus(arguments[0],'active').ok", q)
    check('4-й в работу не берётся', r_ is False)
    shot('06-map-queue')

    section('Победы')
    nav('wins')
    typ('#app input[name=text]', 'Вымышленная победа'); click('#app [data-act=toggleManualAssert]')
    click('#app form button[type=submit]', 0.5)
    check('ручная победа с 💪 добавлена', js("return MP.D.wins().some(function(w){return w.type==='manual'&&w.tag==='assert'})"))
    click('[data-act=winFilter][data-v=assert]')
    check('фильтр 💪 показывает её', 'Вымышленная победа' in js("return document.querySelector('#app').innerText"))
    click('[data-act=winFilter][data-v=all]')
    check('энергия «до → после» показана нейтрально (5.0→4.0, без минуса)', '5.0→4.0' in js("return document.querySelector('.stat:nth-child(3)').innerText") and '-' not in js("return document.querySelector('.stat:nth-child(3) b').innerText"))
    shot('07-wins')

    section('Поддержка')
    nav('support')
    click('[data-act=sosStart][data-k=urge]')
    click('#modal [data-act=sosWhat]')
    click('#modal .energy[data-group=sb] button[data-v="4"]'); click('#modal .energy[data-group=sa] button[data-v="2"]')
    click('#modal [data-act=sosTimer]', 1.2)
    check('таймер пошёл (показывает не 20:00)', js("return document.querySelector('#tmr').innerText") not in ('20:00', ''))
    shot('08-sos')
    click('#modal button[type=submit]', 0.5)
    check('волна сохранена, 4→2', js("var w=MP.D.waves()[0];return w.before===4&&w.after===2"))
    click('[data-act=sosStart][data-k=crit]')
    typ('#modal input[name=s1]', 'вымышленная личная заметка')
    click('#modal button[type=submit]', 0.5)
    check('заметка есть на устройстве', js("return MP.Store.notes.count()") == 1)
    check('заметки нет в данных и в обычном экспорте', 'личная заметка' not in js("return JSON.stringify(MP.Store.exportObject(false))+JSON.stringify(MP.Store.all())"))
    check('без кнопки «Мне трудно» на «Сегодня»', 'трудно' not in js("MP.go('today');return document.querySelector('#app').innerText").lower())

    section('Ещё: опоры, экспорт, импорт')
    nav('more')
    typ('#app form[data-submit=addAnchor] input[name=text]', 'Выпить стакан воды')
    click('#app form[data-submit=addAnchor] button[type=submit]')
    check('опора добавлена', js("return MP.D.anchors().length") == 5)
    click('[data-act=exportText]', 0.6)
    exported = js("var t=document.querySelector('#f-text');return t?t.value:null")
    if exported is None:  # буфер обмена сработал
        exported = js("return JSON.stringify(MP.Store.exportObject(false),null,2)")
    ex = json.loads(exported)
    check('экспорт: app, version=1, 10 списков', ex['app'] == 'mypath' and ex['version'] == 1 and len(ex['data']) == 10)
    check('экспорт без заметок', 'privateNotes' not in ex)
    js("MP.closeModal()")
    projects_before = js("return MP.D.projects().length")
    js("MP.D.deleteProject(arguments[0])", q)
    click('[data-act=importText]')
    typ('#modal textarea[name=t]', '{"сломано"')
    click('#modal button[type=submit]', 0.5)
    check('мусор отклонён с сообщением, данные целы', js("return MP.D.projects().length") == projects_before - 1 and js("return document.querySelector('#toast').classList.contains('show')"))
    js("MP.closeModal()")
    click('[data-act=importText]')
    js("document.querySelector('#modal textarea[name=t]').value=arguments[0]", exported)
    click('#modal button[type=submit]', 0.5)
    shot('09-import-choice')
    click('#modal [data-act=doImport][data-mode=merge]', 0.5)
    check('«Объединить»: удалённый до копии проект остаётся удалённым? (он удалён ПОЗЖЕ копии)', js("return MP.D.project(arguments[0]).deletedAt!==null", q))
    click('[data-act=importText]')
    js("document.querySelector('#modal textarea[name=t]').value=arguments[0]", exported)
    click('#modal button[type=submit]'); click('#modal [data-act=doImport][data-mode=replace]', 0.5)
    check('«Заменить»: всё как в копии, проект вернулся', js("return MP.D.projects().length") == projects_before)
    check('запасная копия появилась', js("return !!MP.Store.backupInfo()"))
    click('[data-act=undoReplace]'); click('#modal [data-act=confirmYes]', 0.5)
    check('«Вернуть» отменяет замену', js("return MP.D.project(arguments[0]).deletedAt!==null", q))
    shot('10-more')

    section('Новый день и возврат в приложение')
    nav('today')
    check('сегодня есть отмеченная опора', js("return document.querySelectorAll('.check.done[data-act=toggleAnchor]').length") >= 1)
    js("window.__real=MP.today;MP.today=function(){return '2999-01-02'};document.dispatchEvent(new Event('visibilitychange'))"); time.sleep(0.4)
    check('в новый день опоры чистые, энергия сброшена', js("return document.querySelectorAll('.check.done[data-act=toggleAnchor]').length") == 0 and js("return MP.D.dayEnergy()") == 0)
    js("MP.today=window.__real"); js("MP.render()")

    section('Ошибки в консоли')
    errs = js("return window.__errs")
    check('ни одной ошибки JavaScript за весь сценарий: %s' % errs, errs == [])

    section('Сохранение после перезагрузки')
    snap = js("return JSON.stringify(MP.Store.all())")
    call('POST', S('/refresh')); time.sleep(1.2)
    check('после перезагрузки данные те же', js("return JSON.stringify(MP.Store.all())") == snap)

    section('PWA: работа без интернета')
    reg = call('POST', S('/execute/async'), {'script': "var cb=arguments[arguments.length-1];navigator.serviceWorker.getRegistration().then(function(r){cb(!!r)})", 'args': []})
    check('service worker зарегистрирован', reg is True)
    call('POST', S('/refresh')); time.sleep(1.5)
    check('после перезагрузки страница под управлением service worker', js("return !!navigator.serviceWorker.controller"))
    r = call('POST', S('/execute/async'), {'script': "var cb=arguments[arguments.length-1];caches.open('mypath-v1').then(function(c){return c.keys()}).then(function(k){cb(k.length)})", 'args': []})
    check('в кэше файлов: %s' % r, isinstance(r, int) and r >= 20)
    snap2 = js("return JSON.stringify(MP.Store.all())")
    server.terminate(); server.wait(); time.sleep(1)       # «интернет пропал»: сайт больше не отвечает
    call('POST', S('/refresh')); time.sleep(2)
    check('БЕЗ сервера приложение открывается из кэша', js("return !!window.MP && document.querySelector('#app').innerText.length>20"))
    check('БЕЗ сервера данные на месте', js("return JSON.stringify(MP.Store.all())") == snap2)
    click('.nav button[data-v=map]'); click('[data-act=newProject]'); typ('#modal input[name=name]', 'Создано без интернета'); click('#modal button[type=submit]')
    check('БЕЗ сервера можно работать (создан проект)', js("return MP.D.projects().some(function(p){return p.name==='Создано без интернета'})"))
    print('  скриншоты:', SHOTS)
finally:
    try: call('DELETE', S(''))
    except Exception: pass
    driver.terminate(); server.terminate()

print('\n%d из %d проверок прошли' % (total - len(fails), total))
if fails:
    print('Не прошли:'); [print('  -', f) for f in fails]
    sys.exit(1)
