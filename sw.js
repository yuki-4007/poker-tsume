// 簡易 Service Worker:
// - ナビゲーション（index.html）は network-first。オンラインなら常に最新版を取得するため、
//   デプロイ後にアプリが永久に古いまま残る事故を防ぐ（オフライン時のみキャッシュ提供）。
// - それ以外の資産は cache-first。Vite のビルド資産はコンテンツハッシュ付きファイル名なので
//   同一URLの内容が変わることはなく、cache-first でも安全。
// バージョン文字列を変えるとキャッシュ名が切り替わり、旧キャッシュは activate 時に破棄される。
const CACHE_VERSION = 'v1';
const CACHE_NAME = `tsume-poker-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // GET以外（POST等）はキャッシュ対象外。
  if (request.method !== 'GET') {
    return;
  }

  // ナビゲーション（HTML）: network-first。最新の index.html を取り込み、
  // オフライン時のみキャッシュにフォールバックする。
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const response = await fetch(request);
          if (response && response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        } catch (error) {
          const cached = await cache.match(request);
          if (cached) {
            return cached;
          }
          throw error;
        }
      }),
    );
    return;
  }

  // ビルド資産等: cache-first + ネットワークフォールバック。
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }

      try {
        const response = await fetch(request);
        if (response && response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        // オフライン等でネットワーク不可の場合、キャッシュがあればそれを返す。
        const fallback = await cache.match(request);
        if (fallback) {
          return fallback;
        }
        throw error;
      }
    }),
  );
});
