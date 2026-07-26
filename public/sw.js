const MEDIA_PATHS = ['/_matrix/client/v1/media/download', '/_matrix/client/v1/media/thumbnail'];
const sessions = new Map();

function mediaPath(url) {
  try {
    return MEDIA_PATHS.some((p) => new URL(url).pathname.startsWith(p));
  } catch {
    return false;
  }
}

function validMediaRequest(url, baseUrl) {
  return MEDIA_PATHS.some((p) => url.startsWith(new URL(p, baseUrl).href));
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const { type, accessToken, baseUrl } = event.data || {};
  if (type === 'setSession' && accessToken && baseUrl) {
    sessions.set(event.source.id, { accessToken, baseUrl });
  }
  if (type === 'clearSession') {
    sessions.delete(event.source.id);
  }
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function requestSession(clientId, timeoutMs) {
  timeoutMs = timeoutMs || 3000;
  const client = await self.clients.get(clientId);
  if (!client) return null;

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    function handler(event) {
      if (event.data && event.data.type === 'setSession') {
        clearTimeout(timer);
        self.removeEventListener('message', handler);
        resolve(event.data);
      }
    }
    self.addEventListener('message', handler);
    client.postMessage({ type: 'requestSession' });
  });
}

self.addEventListener('fetch', (event) => {
  const { url, method, headers } = event.request;
  if (method !== 'GET' || !mediaPath(url)) return;

  if (headers.get('Authorization')) return;

  const clientId = event.clientId;
  if (!clientId) return;

  event.respondWith(
    (async () => {
      try {
        const session = sessions.get(clientId);
        if (session && validMediaRequest(url, session.baseUrl)) {
          const res = await fetch(url, {
            headers: { Authorization: 'Bearer ' + session.accessToken },
            cache: 'default',
          });
          if (res.ok) return res;
        }
      } catch {
        // fall through
      }

      try {
        const s = await requestSession(clientId);
        if (s && validMediaRequest(url, s.baseUrl)) {
          sessions.set(clientId, { accessToken: s.accessToken, baseUrl: s.baseUrl });
          const res = await fetch(url, {
            headers: { Authorization: 'Bearer ' + s.accessToken },
            cache: 'default',
          });
          if (res.ok) return res;
        }
      } catch {
        // fall through
      }

      try {
        return await fetch(event.request);
      } catch {
        return new Response('Service unavailable', { status: 502 });
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
      return undefined;
    })
  );
});
