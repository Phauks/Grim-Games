/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Offline-first service worker (04-architecture.md §1 "Offline"). Every build is precached
// under its own cache name, so a game can run with no signal. A new build waits until the
// user chooses to refresh (UpdateBanner), so an update never reloads a game mid-night.
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { self as sw } from '$app/service-worker';

const CACHE = `grim-games-${version}`;
const SHELL = '/';
const ASSETS = [SHELL, ...immutable.map((file) => file.path), ...assets.map((file) => file.path)];

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') sw.skipWaiting();
});

sw.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	// Live sync and other APIs always go to the network.
	if (url.origin !== sw.location.origin || url.pathname.startsWith('/api/')) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			// App routes are all served by the same SPA shell.
			if (request.mode === 'navigate') {
				return (await cache.match(SHELL)) ?? fetch(request);
			}
			const cached = await cache.match(url.pathname);
			if (cached) return cached;
			return fetch(request);
		})()
	);
});
