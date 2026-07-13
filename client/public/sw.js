// 欧文 Service Worker — 基础离线缓存
const CACHE_NAME = 'owen-v1';
const urlsToCache = ['/m/kyrie', '/'];

self.addEventListener('install', (event: any) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event: any) => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).catch(() => {
        // 离线时返回缓存的页面
        if (event.request.mode === 'navigate') {
          return caches.match('/m/kyrie');
        }
        return undefined;
      });
    })
  );
});

self.addEventListener('activate', (event: any) => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
    ))
  );
  self.clients.claim();
});
