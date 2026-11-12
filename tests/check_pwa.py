#!/usr/bin/env python3
"""Статическая проверка PWA: всё, что использует страница, лежит в кэше service worker; иконки на месте и нужного размера."""
import json, os, re, struct, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()
fails, total = [], [0]
def check(name, cond):
    total[0] += 1
    print(('  ok   ' if cond else '  FAIL ') + name)
    if not cond: fails.append(name)

html, sw = rd('index.html'), rd('sw.js')
manifest = json.loads(rd('manifest.webmanifest'))
cached = set(re.findall(r"'([^']+)'", sw[sw.index('const FILES'):sw.index('];', sw.index('const FILES'))]))
used = set(re.findall(r'<script src="([^"]+)"', html)) | set(re.findall(r'<link[^>]+href="([^"]+)"', html))
used = {u for u in used if not u.startswith('http')}

print('PWA: файлы и кэш')
check('все файлы, подключённые в index.html, есть в списке кэша sw.js: нет в кэше -> %s' % sorted(used - cached), used <= cached)
check('все файлы из списка кэша существуют: нет на диске -> %s' % [f for f in cached if f != './' and not os.path.exists(os.path.join(ROOT, f))],
      all(f == './' or os.path.exists(os.path.join(ROOT, f)) for f in cached))
check('версия кэша задана (mypath-vN)', re.search(r"const CACHE = 'mypath-v\d+'", sw) is not None)
check('ни один файл в кэше не ссылается за пределы папки (все пути относительные)', all(not f.startswith('/') and not f.startswith('http') for f in cached))

print('PWA: манифест')
check('start_url и scope относительные («./»), чтобы работало и в подпапке сайта', manifest['start_url'] == './' and manifest['scope'] == './')
check('display=standalone, есть name/short_name', manifest['display'] == 'standalone' and manifest['name'] and manifest['short_name'])
def size(path):
    b = open(os.path.join(ROOT, path), 'rb').read()
    assert b[:8] == b'\x89PNG\r\n\x1a\n', 'не PNG'
    return struct.unpack('>II', b[16:24])
for ic in manifest['icons']:
    check('иконка %s существует и её размер %s' % (ic['src'], ic['sizes']), '%dx%d' % size(ic['src']) == ic['sizes'])
check('apple-touch-icon 180x180 (для iPhone)', size('icons/apple-touch-icon.png') == (180, 180))
check('в index.html есть viewport-fit=cover, manifest и apple-touch-icon', 'viewport-fit=cover' in html and 'rel="manifest"' in html and 'rel="apple-touch-icon"' in html)
check('режим приложения для iPhone включён (apple-mobile-web-app-capable)', 'apple-mobile-web-app-capable' in html)

print('\n%d из %d проверок прошли' % (total[0] - len(fails), total[0]))
sys.exit(1 if fails else 0)
