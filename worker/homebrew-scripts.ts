/**
 * `/api/homebrew-scripts` and `/api/homebrew-scripts/<slug>`: the BOTC HomeBrew Wiki's
 * published scripts for Search (`homebrew-scripts-api.ts`). The browser can't read the site
 * itself (no CORS). Not an open proxy: it only requests the site's fixed read endpoints, with
 * a slug in the site's own format, and caches the answers so repeated taps don't reach it.
 */
import {
	HOMEBREW_ORIGIN,
	HOMEBREW_SLUG,
	readHomebrewScripts
} from '../src/lib/features/scripts/homebrew-scripts-api.ts';

const CACHE_SECONDS = 3600;
/** The character grid is the whole wiki's: a few hundred kilobytes today. */
const MAX_BYTES = 8_000_000;

class UpstreamError extends Error {}
class NotFound extends Error {}

async function getText(path: string): Promise<string> {
	const response = await fetch(`${HOMEBREW_ORIGIN}${path}`, {
		headers: { Accept: 'application/json' },
		redirect: 'follow',
		cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true }
	});
	if (response.status === 404) throw new NotFound();
	if (!response.ok) {
		throw new UpstreamError(`The Homebrew Wiki answered with HTTP ${response.status}.`);
	}
	const body = await response.text();
	if (body.length > MAX_BYTES) throw new UpstreamError('The answer is too large.');
	return body;
}

function parse(body: string): unknown {
	try {
		return JSON.parse(body);
	} catch {
		throw new UpstreamError('The Homebrew Wiki did not return JSON.');
	}
}

const headers = { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` };

export async function handleHomebrewScripts(url: URL): Promise<Response> {
	try {
		if (url.pathname === '/api/homebrew-scripts') {
			const [list, grid] = await Promise.all([
				getText('/scripts.json?fields=browse'),
				getText('/characters.json?fields=grid')
			]);
			const scripts = readHomebrewScripts(parse(list), parse(grid));
			if (scripts.length === 0) {
				console.warn('homebrew-scripts', 'empty list');
				return Response.json(
					{ error: 'The Homebrew Wiki listed no scripts.' },
					{ status: 502, headers: { 'Cache-Control': 'no-store' } }
				);
			}
			return Response.json({ scripts }, { headers });
		}
		const slug = url.pathname.match(/^\/api\/homebrew-scripts\/([^/]+)$/)?.[1];
		if (!slug || !HOMEBREW_SLUG.test(slug)) return new Response('Not found', { status: 404 });
		const script = parse(
			await getText(`/api/page-json?type=script&slug=${encodeURIComponent(slug)}`)
		);
		if (!Array.isArray(script)) throw new UpstreamError('The script is not in the script format.');
		return Response.json(script, { headers });
	} catch (e) {
		if (e instanceof NotFound) return new Response('Not found', { status: 404 });
		const message = e instanceof UpstreamError ? e.message : 'Could not reach the Homebrew Wiki.';
		console.warn('homebrew-scripts', message);
		return Response.json({ error: message }, { status: 502 });
	}
}
