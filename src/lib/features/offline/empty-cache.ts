/**
 * Empties a Cache Storage cache, leaving the cache itself, so the browser frees its room at once.
 *
 * Deleting the cache instead only takes its name away: Cache objects still held keep working
 * (Service Workers spec, CacheStorage delete(): "the existing DOM objects ... should remain
 * functional"). The offline worker holds one whenever it has served from the cache, so Chromium
 * went on counting the deleted files in `navigator.storage.estimate()` and the worker went on
 * storing into a cache the app could no longer see (Trevor, 2026-11-16: storage cleared in
 * Settings > Data, About's figure unchanged). Removing the entries frees them straight away.
 */
export async function emptyCache(store: CacheStorage, name: string): Promise<void> {
	if (!(await store.has(name))) return;
	const cache = await store.open(name);
	for (const request of await cache.keys()) await cache.delete(request);
}
