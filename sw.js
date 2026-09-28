// Service-Worker: offline spielbar, Cache-Busting über Inhalts-Hash (tools/update_sw.py)
const VERSION = '5deb8cd07c';
const CACHE = 'bandenkick-' + VERSION;
const ASSETS = [
  './',
  'assets/hdri/env_1k.hdr',
  'assets/hdri/sky.jpg',
  'assets/hdri/sky.json',
  'assets/tex/grass_color.jpg',
  'assets/tex/grass_normal.jpg',
  'assets/tex/turf_color.jpg',
  'assets/tex/turf_normal.jpg',
  'css/style.css',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'index.html',
  'lib/three/addons/loaders/HDRLoader.js',
  'lib/three/addons/utils/BufferGeometryUtils.js',
  'lib/three/three.core.min.js',
  'lib/three/three.module.min.js',
  'manifest.webmanifest',
  'src/build.js',
  'src/input/input.js',
  'src/main.js',
  'src/render/actors.js',
  'src/render/camera.js',
  'src/render/field.js',
  'src/render/scene.js',
  'src/sim/aero.js',
  'src/sim/ball.js',
  'src/sim/lab.js',
  'src/sim/params.js',
  'src/sim/player.js',
  'src/sim/rng.js',
  'src/sim/step.js',
  'src/sim/v3.js',
  'src/sim/world.js',
  'src/ui/hud.js'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('bandenkick-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('index.html', { cacheName: CACHE }).then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then((r) => r || fetch(req).then((res) => {
    if (res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
    return res;
  })));
});
