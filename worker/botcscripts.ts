/**
 * `/api/botcscripts/script/<pk>[/<version>]` and `/api/botcscripts/version/<pk>` load one
 * script from BotC Scripts for the browser, which can't call botcscripts.com itself
 * (08-script-loading.md §4.2). `/api/botcscripts/search/<page>[/<term>]` lists one page of
 * search results, slimmed to names (no script JSON). Not an open proxy: it only ever
 * requests the site's read-only script endpoints, built from the path, and caches answers
 * for 10 minutes so repeated searches don't reach the site (its robots.txt asks crawlers
 * to stay away; this is only ever one request per tap or typed search).
 */
import {
	BOTC_SCRIPTS_ORIGIN,
	parseProxyPath,
	parseSearchPath,
	pickVersionId,
	readSearchPage,
	readVersion,
	upstreamSearchPath
} from '../src/lib/features/scripts/botcscripts-api.ts';

/** Scripts are a few KB; anything far bigger is not a script. */
const MAX_BYTES = 1_000_000;
const CACHE_SECONDS = 600;

class LookupError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
	}
}

async function getJson(path: string): Promise<unknown> {
	const response = await fetch(`${BOTC_SCRIPTS_ORIGIN}${path}`, {
		headers: { Accept: 'application/json' },
		redirect: 'follow',
		cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true }
	});
	if (response.status === 404) throw new LookupError(404, 'BotC Scripts has no such script.');
	if (!response.ok) {
		throw new LookupError(502, `BotC Scripts answered with HTTP ${response.status}.`);
	}
	const text = await response.text();
	if (text.length > MAX_BYTES) throw new LookupError(502, 'The script is too large.');
	try {
		return JSON.parse(text);
	} catch {
		throw new LookupError(502, 'BotC Scripts did not return JSON.');
	}
}

async function handleSearch(term: string, page: number): Promise<Response> {
	try {
		const found = readSearchPage(await getJson(upstreamSearchPath(term, page)), page);
		if (!found) throw new LookupError(502, 'BotC Scripts returned something unexpected.');
		return Response.json(found, {
			headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` }
		});
	} catch (error) {
		if (error instanceof LookupError) {
			// The site answers 404 for a page past the end.
			if (error.status === 404)
				return Response.json({ page, count: 0, hasMore: false, results: [] });
			return Response.json({ error: error.message }, { status: error.status });
		}
		return Response.json({ error: 'Could not reach BotC Scripts.' }, { status: 502 });
	}
}

export async function handleBotcScripts(pathname: string): Promise<Response> {
	const search = parseSearchPath(pathname);
	if (search) return handleSearch(search.term, search.page);
	const ref = parseProxyPath(pathname);
	if (!ref) return Response.json({ error: 'Not a BotC Scripts script.' }, { status: 400 });
	try {
		let versionId: number | undefined;
		if (ref.kind === 'version') versionId = ref.versionId;
		else {
			versionId = pickVersionId(await getJson(`/api/script_ids/${ref.scriptId}/`), ref.version);
			if (versionId === undefined) {
				throw new LookupError(
					404,
					ref.version
						? `That script has no version ${ref.version}.`
						: 'That script has no versions.'
				);
			}
		}
		const version = readVersion(await getJson(`/api/scripts/${versionId}/`));
		if (!version) throw new LookupError(502, 'BotC Scripts returned something unexpected.');
		return Response.json(version, {
			headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` }
		});
	} catch (error) {
		if (error instanceof LookupError) {
			return Response.json({ error: error.message }, { status: error.status });
		}
		return Response.json({ error: 'Could not reach BotC Scripts.' }, { status: 502 });
	}
}
