// Название кэша и версия (меняй версию, чтобы принудительно обновить файлы у пользователей)
const CACHE_NAME = 'fazenda-pwa-v1';

// Список ресурсов для обязательного кэширования
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    './icon.svg',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/paho-mqtt/1.0.1/mqttws31.min.js'
];

// 1. Установка: скачиваем все файлы в кэш
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Кэширование ресурсов');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting()) // Активируем SW сразу
    );
});

// 2. Активация: чистим старые версии кэша, если они есть
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[SW] Удаление старого кэша:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// 3. Перехват запросов: работаем через кэш
self.addEventListener('fetch', (event) => {
    // Игнорируем запросы не по протоколу http/https (например, chrome-extension)
    if (!(event.request.url.indexOf('http') === 0)) return;

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Если файл есть в кэше — отдаем его
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Если файла нет в кэше — идем в сеть
                return fetch(event.request).then((networkResponse) => {
                    // Проверяем, что ответ от сети корректный
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse;
                    }

                    // Клонируем ответ, чтобы сохранить его в кэш на будущее
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                    return networkResponse;
                });
            }).catch(() => {
                // Здесь можно добавить обработку ошибок, если нет ни сети, ни кэша
                console.log('[SW] Ресурс не найден ни в кэше, ни в сети');
            })
    );
});
