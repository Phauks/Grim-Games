/**
 * `/api/botcscripts/script/<pk>[/<version>]` and `/api/botcscripts/version/<pk>` load one
 * script from BotC Scripts for the browser, which can't call botcscripts.com itself
 * (08-script-loading.md §4.2). `/api/botcscripts/search?page=&q=&sort=&…` lists one page
 * of search results with filters, slimmed to names and character ids (no abilities or
 * night text). Not an open proxy: it only ever requests the site's read-only script
 * endpoints, rebuilt from allow-listed parameters, and caches answers for 10 minutes so
 * repeated searches don't reach the site (its robots.txt asks crawlers to stay away; this
 * is only ever one request per tap or typed search).
 */
import {
	BOTC_SCRIPTS_ORIGIN,
	parseProxyPath,
	parseSearchUrl,
	parseVersionsPath,
	pickVersionId,
	readCharacterEditions,
	readSearchPage,
	readVersion,
	readVersionList,
	upstreamSearchPath,
	type BotcScriptsQuery,
	type CharacterEditions
} from '../src/lib/features/scripts/botcscripts-api.ts';

/** Scripts are a few KB; anything far bigger is not a script. */
const MAX_BYTES = 1_000_000;
/** A search page holds 50 whole scripts, homebrew abilities included. */
const MAX_SEARCH_BYTES = 6_000_000;
const CACHE_SECONDS = 600;
/** Which group each character is in changes only when TPI releases characters. */
const CHARACTERS_CACHE_SECONDS = 86_400;

class LookupError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
	}
}

async function getJson(
	path: string,
	maxBytes = MAX_BYTES,
	cacheTtl = CACHE_SECONDS
): Promise<unknown> {
	const response = await fetch(`${BOTC_SCRIPTS_ORIGIN}${path}`, {
		headers: { Accept: 'application/json' },
		redirect: 'follow',
		cf: { cacheTtl, cacheEverything: true }
	});
	if (response.status === 404) throw new LookupError(404, 'BotC Scripts has no such script.');
	if (!response.ok) {
		throw new LookupError(502, `BotC Scripts answered with HTTP ${response.status}.`);
	}
	const text = await response.text();
	if (text.length > maxBytes) throw new LookupError(502, 'The answer is too large.');
	try {
		return JSON.parse(text);
	} catch {
		throw new LookupError(502, 'BotC Scripts did not return JSON.');
	}
}

let characterEditions: CharacterEditions | undefined;

/** The site's character groups, needed only to leave a group out (`editionFilter`). */
async function siteEditions(): Promise<CharacterEditions> {
	if (characterEditions) return characterEditions;
	const found = readCharacterEditions(
		await getJson('/api/characters', MAX_BYTES, CHARACTERS_CACHE_SECONDS)
	);
	if (!found) throw new LookupError(502, 'BotC Scripts returned something unexpected.');
	characterEditions = found;
	return found;
}

async function handleSearch(query: BotcScriptsQuery, page: number): Promise<Response> {
	try {
		const editions = query.editions ? await siteEditions() : undefined;
		const found = readSearchPage(
			await getJson(upstreamSearchPath(query, page, editions), MAX_SEARCH_BYTES),
			page
		);
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

/** `/api/botcscripts/versions/<pk>`: every version the site publishes for one script. */
async function handleVersions(scriptId: number): Promise<Response> {
	try {
		const list = readVersionList(scriptId, await getJson(`/api/script_ids/${scriptId}/`));
		if (!list) throw new LookupError(502, 'BotC Scripts returned something unexpected.');
		return Response.json(list, {
			headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` }
		});
	} catch (error) {
		if (error instanceof LookupError) {
			return Response.json({ error: error.message }, { status: error.status });
		}
		return Response.json({ error: 'Could not reach BotC Scripts.' }, { status: 502 });
	}
}

export async function handleBotcScripts(url: URL): Promise<Response> {
	const { pathname } = url;
	const search = parseSearchUrl(url);
	if (search) return handleSearch(search.query, search.page);
	const versionsOf = parseVersionsPath(pathname);
	if (versionsOf !== undefined) return handleVersions(versionsOf);
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
