// Service worker: хранит копию приложения в телефоне, чтобы оно открывалось без интернета.
// ВАЖНО: когда меняешь любой файл приложения и выкладываешь заново — увеличь число в CACHE
// (mypath-v1 → mypath-v2), иначе телефон будет показывать старую версию.
const CACHE = 'mypath-v4';

const FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'css/style.css',
  'js/util.js', 'js/seed.js', 'js/legacy.js', 'js/store.js', 'js/domain.js', 'js/ui.js', 'js/components.js',
  'js/view-today.js', 'js/view-map.js', 'js/view-wins.js', 'js/view-support.js', 'js/sync-file.js', 'js/view-more.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  // Все файлы кладём в кэш этой версии разом: версии не смешиваются
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('mypath-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Сначала кэш, потом сеть. Данные пользователя здесь не хранятся — они в localStorage.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
