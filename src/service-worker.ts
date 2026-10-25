/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Offline-first service worker (04-architecture.md §1 "Offline"). Every build is precached
// under its own cache name, so a game can run with no signal. A new build waits until the
// user chooses to refresh (UpdateBanner), so an open game is never reloaded by an update. A
// new build still starts by itself when the app is next launched with no tab open (web.dev/
// articles/service-worker-lifecycle); the game then reopens from its save (persistence.ts).
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { self as sw } from '$app/service-worker';
import {
	BUILD_CACHE_PREFIX,
	cachedOnUse,
	parseHashes,
	precached,
	PRECACHE_HASHES_PATH,
	RUNTIME_CACHE,
	staleCaches,
	unchanged,
	type FileHashes,
	type KeepOfflineMessage
} from '#lib/features/offline/cache-rules.ts';
import {
	byShape,
	fileName,
	namePattern,
	parseChunks,
	PRECACHE_CHUNKS_PATH,
	REBUILDABLE,
	renamed,
	type Chunks
} from '#lib/features/offline/chunk-renames.ts';
import {
	parseSizes,
	percentDone,
	PRECACHE_PROGRESS,
	PRECACHE_SIZES_PATH,
	totalBytes,
	type PrecacheProgress
} from '#lib/features/about/update-progress.ts';

const CACHE = `${BUILD_CACHE_PREFIX}${version}`;
const SHELL = '/';
// Manifest paths are relative to the worker; the cache rules match absolute paths.
const BUILD = [...immutable, ...assets].map(
	(file) => new URL(file.path, sw.location.href).pathname
);
// Only what a game needs is stored at install; the rest is stored on first use.
const ASSETS = [SHELL, ...BUILD.filter(precached)];

/** Marks which icon data the runtime cache holds (`fetchedAt` of `/data/manifest.json`). */
const ICON_DATA_KEY = '/__icon-data';
/** Names the precache of the build that is active, so the next build knows which it replaces. */
const ACTIVE_BUILD_KEY = '/__active-build';

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
		.map((request) => new URL(request.url))
		.filter((url) => url.origin === sw.location.origin && url.pathname.startsWith('/data/icons/'))
		.map((url) => url.pathname);
	await Promise.all(icons.map((path) => store(runtime, path)));
	await runtime.put(ICON_DATA_KEY, new Response(fetchedAt ?? ''));
}

/** A JSON file of this build, straight from the network; `{}` when it can't be read. */
function fetchJson(path: string): Promise<unknown> {
	return fetch(path, { cache: 'no-store' })
		.then((response) => (response.ok ? response.json() : {}))
		.catch(() => ({}));
}

/** The precache of the build this one replaces, while it is still active. */
async function previousBuild(): Promise<Cache | undefined> {
	const marker = await (await caches.open(RUNTIME_CACHE)).match(ACTIVE_BUILD_KEY);
	const name = marker ? await marker.text() : undefined;
	return name && name !== CACHE && (await caches.has(name)) ? caches.open(name) : undefined;
}

/**
 * The stored copy of a file an earlier build already holds unchanged, if any: a build file
 * from any cache (its name is its content), another file from the previous build when its
 * content hash is the same.
 */
async function keptCopy(
	path: string,
	hashes: FileHashes,
	previous: { cache: Cache | undefined; hashes: FileHashes }
): Promise<Response | undefined> {
	if (!unchanged(path, hashes, previous.hashes)) return undefined;
	if (path.startsWith('/_app/immutable/')) return caches.match(path);
	return previous.cache?.match(path);
}

/** First 16 hex digits of SHA-256 over the text's UTF-8 bytes, as the build hashes files. */
async function hashText(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(digest).slice(0, 8)]
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * Rebuilds a build file that only got a new name because a file it imports changed, from the
 * stored file with the same shape (chunk-renames.ts). Undefined when there is none, or when the
 * result is not the published content.
 */
async function rebuiltCopy(
	path: string,
	chunks: Chunks,
	previous: { shapes: Map<string, string>; pattern: RegExp | undefined }
): Promise<Response | undefined> {
	const info = chunks[path];
	const from = info && REBUILDABLE.test(path) ? previous.shapes.get(info.shape) : undefined;
	const stored = from ? await caches.match(from) : undefined;
	if (!info || !stored) return undefined;
	const text = renamed(await stored.text(), previous.pattern, info.names);
	if (text === undefined || (await hashText(text)) !== info.hash) return undefined;
	return new Response(text, {
		headers: { 'Content-Type': stored.headers.get('Content-Type') ?? 'text/javascript' }
	});
}

/**
 * Stores the build. Files the previous build already holds unchanged are copied from it, so
 * an update only downloads what changed (Trevor, 2026-10-19: a full download each time
 * stuttered). Files that were only renamed are rebuilt from their stored copy (Trevor,
 * 2026-10-23: updates still felt slow). The rest come a few at a time, telling every open page how far it has got
 * (About's Check for updates shows it). Any file failing fails the install, as addAll did.
 */
async function precache(cache: Cache): Promise<void> {
	// The build's file sizes, so the page can say "2.4 MB of 6.1 MB"; without them, files only.
	const [sizes, hashes, chunks] = await Promise.all([
		fetchJson(PRECACHE_SIZES_PATH).then(parseSizes),
		fetchJson(PRECACHE_HASHES_PATH).then(parseHashes),
		fetchJson(PRECACHE_CHUNKS_PATH).then(parseChunks)
	]);
	const previousCache = await previousBuild().catch(() => undefined);
	const previous = {
		cache: previousCache,
		hashes: parseHashes(
			await previousCache
				?.match(PRECACHE_HASHES_PATH)
				.then((response) => response?.json())
				.catch(() => ({}))
		)
	};
	const previousChunks = parseChunks(
		await previousCache
			?.match(PRECACHE_CHUNKS_PATH)
			.then((response) => response?.json())
			.catch(() => ({}))
	);
	const renames = {
		shapes: byShape(previousChunks),
		pattern: namePattern(Object.keys(previousChunks).map(fileName))
	};
	// All at once: one at a time, the ~400 stored copies took over a second.
	const stored = await Promise.all(
		ASSETS.map(async (path) => {
			const copy =
				(await keptCopy(path, hashes, previous).catch(() => undefined)) ??
				(await rebuiltCopy(path, chunks, renames).catch(() => undefined));
			if (copy) await cache.put(path, copy);
			return !!copy;
		})
	);
	const queue = ASSETS.filter((_, i) => !stored[i]);
	// Kept with the build, for the next one to compare against.
	await cache.put(PRECACHE_HASHES_PATH, Response.json(hashes));
	await cache.put(PRECACHE_CHUNKS_PATH, Response.json(chunks));

	const total = queue.length;
	const allBytes = totalBytes(queue, sizes);
	let done = 0;
	let bytes = 0;
	let told = -1;
	const tell = async () => {
		const progress = {
			done,
			total,
			...(allBytes === undefined ? {} : { bytes, totalBytes: allBytes })
		};
		// Each whole percent at most once, so a large build doesn't flood the pages.
		const percent = percentDone(progress);
		if (percent === told) return;
		told = percent;
		const message: PrecacheProgress = { type: PRECACHE_PROGRESS, ...progress };
		for (const client of await sw.clients.matchAll({ includeUncontrolled: true, type: 'window' }))
			client.postMessage(message);
	};
	const next = async (): Promise<void> => {
		const path = queue.shift();
		if (!path) return;
		const response = await fetch(path);
		if (!response.ok) throw new Error(`${path}: ${response.status}`);
		await cache.put(path, response);
		done++;
		bytes += sizes[path] ?? 0;
		await tell();
		await next();
	};
	await tell();
	await Promise.all([next(), next(), next(), next()]);
}

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await precache(cache);
			await refreshIcons(cache).catch(() => {});
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const runtime = await caches.open(RUNTIME_CACHE);
			const marker = await runtime.match(ACTIVE_BUILD_KEY);
			const previous = marker ? await marker.text() : undefined;
			// Tabs still on the previous build keep its files until the next update.
			for (const key of staleCaches(await caches.keys(), CACHE, previous)) {
				await caches.delete(key);
			}
			if (previous !== CACHE) await runtime.put(ACTIVE_BUILD_KEY, new Response(CACHE));
			// Runtime copies of older builds' hashed files (fonts) are not kept.
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

/**
 * Stores a homebrew character's image from another site, keyed by its full URL. Only a host
 * that allows CORS can be stored: an opaque (no-cors) response would be counted as several
 * MB of storage each by Chrome, which is what this cache exists to avoid.
 */
async function storeImage(cache: Cache, url: string): Promise<void> {
	try {
		const response = await fetch(url, {
			mode: 'cors',
			credentials: 'omit',
			referrerPolicy: 'no-referrer'
		});
		if (response.ok) await cache.put(url, response);
	} catch {
		// No CORS, or offline: the image still shows online, straight from its host.
	}
}

/** Stores the URLs the app asked for that are not stored yet, a few at a time. */
async function keepOffline(urls: string[]): Promise<void> {
	const cache = await caches.open(RUNTIME_CACHE);
	const missing: string[] = [];
	for (const raw of urls) {
		const url = new URL(raw, sw.location.origin);
		const key = url.origin === sw.location.origin ? url.pathname : url.href;
		if (url.origin === sw.location.origin && !cachedOnUse(key)) continue;
		if (!/^https?:$/.test(url.protocol)) continue;
		if (!(await cache.match(key))) missing.push(key);
	}
	const next = async (): Promise<void> => {
		const key = missing.shift();
		if (!key) return;
		if (key.startsWith('/')) await store(cache, key);
		else await storeImage(cache, key);
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
	// Homebrew images from other sites: the copy stored with the script, else the network.
	if (url.origin !== sw.location.origin && request.destination === 'image') {
		event.respondWith(
			(async () => {
				const runtime = await caches.open(RUNTIME_CACHE);
				return (await runtime.match(url.href)) ?? fetch(request);
			})()
		);
		return;
	}
	// Live sync and other APIs always go to the network.
	if (url.origin !== sw.location.origin || url.pathname.startsWith('/api/')) return;
	// The app's version is the build this worker holds. SvelteKit reloads a page that ends in an
	// error (such as a bad address) when version.json names a newer build, but a newer build
	// only takes over on Refresh, so that reload brought the same page back endlessly.
	if (url.pathname === '/_app/version.json') {
		event.respondWith(Response.json({ version }, { headers: { 'Cache-Control': 'no-store' } }));
		return;
	}

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			// App routes are all served by the same SPA shell.
			if (request.mode === 'navigate') {
				return (await cache.match(SHELL)) ?? fetch(request);
			}
			const cached = await cache.match(url.pathname);
			if (cached) return cached;
			// A tab still running the previous build asks for its own hashed files.
			if (url.pathname.startsWith('/_app/immutable/')) {
				const older = await caches.match(url.pathname);
				if (older) return older;
			}
			if (!cachedOnUse(url.pathname)) return fetch(request);
			const runtime = await caches.open(RUNTIME_CACHE);
			const stored = await runtime.match(url.pathname);
			if (stored) return stored;
			return (await store(runtime, url.pathname)) ?? fetch(request);
		})()
	);
});
