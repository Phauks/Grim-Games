/**
 * `/api/botcscripts/script/<pk>[/<version>]` and `/api/botcscripts/version/<pk>`: loads one
 * script from BotC Scripts for the browser, which can't call botcscripts.com itself
 * (08-script-loading.md §4.2). Not an open proxy: it only ever requests the two read-only
 * API endpoints, with ids taken from the path, and returns one script version.
 */
import {
	BOTC_SCRIPTS_ORIGIN,
	parseProxyPath,
	pickVersionId,
	readVersion
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

export async function handleBotcScripts(pathname: string): Promise<Response> {
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
