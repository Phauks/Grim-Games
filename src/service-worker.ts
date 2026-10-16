/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Offline-first service worker (04-architecture.md §1 "Offline"). Every build is precached
// under its own cache name, so a game can run with no signal. A new build waits until the
// user chooses to refresh (UpdateBanner), so an update never reloads a game mid-night.
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { self as sw } from '$app/service-worker';
import {
	cachedOnUse,
	precached,
	RUNTIME_CACHE,
	type KeepOfflineMessage
} from '#lib/features/offline/cache-rules.ts';

const CACHE = `grim-games-${version}`;
const SHELL = '/';
// Manifest paths are relative to the worker; the cache rules match absolute paths.
const BUILD = [...immutable, ...assets].map(
	(file) => new URL(file.path, sw.location.href).pathname
);
// Only what a game needs is stored at install; the rest is stored on first use.
const ASSETS = [SHELL, ...BUILD.filter(precached)];

/** Marks which icon data the runtime cache holds (`fetchedAt` of `/data/manifest.json`). */
const ICON_DATA_KEY = '/__icon-data';

/**
 * Icons are not hashed, so when a build brings newly synced icon data, the icons already
 * stored are fetched again. This runs at install, which happens online.
 */
async function refreshIcons(cache: Cache): Promise<void> {
	const manifest = await cache.match('/data/manifest.json');
	if (!manifest) return;
	const { fetchedAt } = (await manifest.json()) as { fetchedAt?: string };
	const runtime = await caches.open(RUNTIME_CACHE);
	const marker = await runtime.match(ICON_DATA_KEY);
	if (marker && (await marker.text()) === fetchedAt) return;
	const icons = (await runtime.keys())
		.map((request) => new URL(request.url).pathname)
		.filter((path) => path.startsWith('/data/icons/'));
	await Promise.all(icons.map((path) => store(runtime, path)));
	await runtime.put(ICON_DATA_KEY, new Response(fetchedAt ?? ''));
}

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(ASSETS);
			await refreshIcons(cache).catch(() => {});
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE && key !== RUNTIME_CACHE) await caches.delete(key);
			}
			// Hashed files from older builds are never asked for again.
			const runtime = await caches.open(RUNTIME_CACHE);
			const current = new Set(BUILD);
			for (const request of await runtime.keys()) {
				const path = new URL(request.url).pathname;
				if (path.startsWith('/_app/immutable/') && !current.has(path)) {
					await runtime.delete(request);
				}
			}
			await sw.clients.claim();
		})()
	);
});

/** Fetches and stores a file in the runtime cache. Failures are left for the next use. */
async function store(cache: Cache, path: string): Promise<Response | undefined> {
	try {
		const response = await fetch(path);
		if (response.ok) await cache.put(path, response.clone());
		return response;
	} catch {
		return undefined;
	}
}

/** Stores the URLs the app asked for that are not stored yet, a few at a time. */
async function keepOffline(urls: string[]): Promise<void> {
	const cache = await caches.open(RUNTIME_CACHE);
	const missing: string[] = [];
	for (const url of urls) {
		const path = new URL(url, sw.location.origin).pathname;
		if (cachedOnUse(path) && !(await cache.match(path))) missing.push(path);
	}
	const next = async (): Promise<void> => {
		const path = missing.shift();
		if (!path) return;
		await store(cache, path);
		await next();
	};
	await Promise.all([next(), next(), next(), next()]);
}

sw.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') sw.skipWaiting();
	if (event.data?.type === 'KEEP_OFFLINE') {
		event.waitUntil(keepOffline((event.data as KeepOfflineMessage).urls));
	}
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
			if (!cachedOnUse(url.pathname)) return fetch(request);
			const runtime = await caches.open(RUNTIME_CACHE);
			const stored = await runtime.match(url.pathname);
			if (stored) return stored;
			return (await store(runtime, url.pathname)) ?? fetch(request);
		})()
	);
});
