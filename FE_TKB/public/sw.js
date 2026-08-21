/**
 * Service worker: lets a teacher read this week's timetable with no signal.
 *
 * Deliberately conservative about what it serves stale. A timetable that is one refresh out
 * of date is far better than no timetable in a corridor, but silently serving week-old app
 * code would be a debugging nightmare, so:
 *
 *   - navigations and app code  -> network first, cache only as a fallback
 *   - the schedule API          -> network first, and the last good answer is kept
 *   - static assets and icons   -> cache first, they are content-hashed anyway
 *
 * Bump CACHE_VERSION to retire every old cache on the next activation.
 */
const CACHE_VERSION = 'tkb-v1';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

/** Answers worth keeping so the schedule still renders offline. */
const CACHEABLE_API = [/\/algorithm\/result\//, /\/schedule\/effective/, /\/giao-vien\//, /\/auth\/profile/];

self.addEventListener('install', (event) => {
  // Take over as soon as this version is installed rather than waiting for every tab to close
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(['/teacher/schedule', '/icon-192.png', '/manifest.webmanifest']).catch(() => {
        // A missing entry must not abort the install and leave the app with no worker
      }),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache a login or a token exchange - a stale answer there is a security problem,
  // not a convenience
  if (url.pathname.includes('/auth/login') || url.pathname.includes('/auth/captcha')) return;

  const isApi = CACHEABLE_API.some((pattern) => pattern.test(url.pathname));
  if (isApi) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
  }
});

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Offline with nothing cached: say so in Vietnamese rather than showing the browser's
    // dinosaur, which tells a teacher nothing about what to do
    if (request.mode === 'navigate') {
      return new Response(
        `<!doctype html><html lang="vi"><head><meta charset="utf-8">
         <meta name="viewport" content="width=device-width,initial-scale=1">
         <title>Không có mạng</title>
         <style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;
         height:100vh;margin:0;text-align:center;padding:24px;color:#334155}
         h1{font-size:19px;margin:0 0 8px}p{margin:0;font-size:15px;color:#64748b}</style>
         </head><body><div><h1>Chưa có mạng</h1>
         <p>Mở lại trang thời khóa biểu bạn đã xem trước đó để đọc bản đã lưu.</p>
         </div></body></html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 },
      );
    }
    throw new Error('offline');
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}
