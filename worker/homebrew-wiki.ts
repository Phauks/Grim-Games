/**
 * `/api/homebrew-wiki/collections` and `/api/homebrew-wiki/collections/<id>`: the BotC
 * Homebrew Wiki's collections for the Script builder (`homebrew-wiki-api.ts`). The browser
 * can't read the site itself (no CORS). Not an open proxy: it only requests the three fixed
 * read endpoints, with an id that must be one of the site's own collections, and caches the
 * answers so repeated taps don't reach the site.
 */
import {
	COLLECTION_ID,
	HOMEBREW_WIKI_ORIGIN,
	readCollections,
	readCredits,
	type HomebrewCollectionAnswer
} from '../src/lib/features/script-builder/homebrew-wiki-api.ts';

const CACHE_SECONDS = 3600;
/** The character feed is the whole wiki's grid: a few hundred kilobytes today. */
const MAX_BYTES = 8_000_000;

class UpstreamError extends Error {}

async function getJson(path: string): Promise<unknown> {
	const response = await fetch(`${HOMEBREW_WIKI_ORIGIN}${path}`, {
		headers: { Accept: 'application/json' },
		redirect: 'follow',
		cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true }
	});
	if (!response.ok) {
		throw new UpstreamError(`The Homebrew Wiki answered with HTTP ${response.status}.`);
	}
	const body = await response.text();
	if (body.length > MAX_BYTES) throw new UpstreamError('The answer is too large.');
	try {
		return JSON.parse(body);
	} catch {
		throw new UpstreamError('The Homebrew Wiki did not return JSON.');
	}
}

const cached = (body: unknown) =>
	Response.json(body, { headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` } });

export async function handleHomebrewWiki(url: URL): Promise<Response> {
	try {
		if (url.pathname === '/api/homebrew-wiki/collections') {
			return cached(readCollections(await getJson('/collections.json')));
		}
		const id = url.pathname.match(/^\/api\/homebrew-wiki\/collections\/([^/]+)$/)?.[1];
		if (!id || !COLLECTION_ID.test(id)) return new Response('Not found', { status: 404 });
		const collections = readCollections(await getJson('/collections.json'));
		if (!collections.some((c) => c.id === id)) return new Response('Not found', { status: 404 });
		const [script, grid] = await Promise.all([
			getJson(`/api/page-json?type=collection&slug=${encodeURIComponent(id)}`),
			getJson('/characters.json?fields=grid')
		]);
		if (!Array.isArray(script)) throw new UpstreamError('The collection is not a script.');
		const answer: HomebrewCollectionAnswer = { script, credits: readCredits(grid, script, id) };
		return cached(answer);
	} catch (e) {
		const message = e instanceof UpstreamError ? e.message : 'Could not reach the Homebrew Wiki.';
		return Response.json({ error: message }, { status: 502 });
	}
}
