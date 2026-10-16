/**
 * `/api/curated`: the scripts TPI lists on its Scripts page, for the script picker's
 * Curated source. The browser can't read that page itself (no CORS). Only ever fetches
 * that one page, once per tap that needs it, cached for an hour; the scripts are decoded
 * from their Script Tool links here, so nothing else is requested. Design: 08 §5.6.
 */
import { CURATED_PAGE, type CuratedScript } from '../src/lib/features/scripts/curated-api.ts';
import {
	decodeScriptToolPayload,
	readCuratedPage,
	scriptToolPayload
} from '../src/lib/features/scripts/script-tool-link.ts';

const CACHE_SECONDS = 3600;
/** The page is a store page with its scripts inline; far bigger is not that page. */
const MAX_PAGE_BYTES = 3_000_000;

async function readScript(section: string, link: string): Promise<CuratedScript | undefined> {
	const payload = scriptToolPayload(link);
	if (!payload) return undefined;
	try {
		const json: unknown = JSON.parse(await decodeScriptToolPayload(payload));
		return Array.isArray(json) ? { section, link, json } : undefined;
	} catch {
		return undefined;
	}
}

export async function handleCurated(): Promise<Response> {
	let html: string;
	try {
		const response = await fetch(CURATED_PAGE, {
			headers: { Accept: 'text/html' },
			redirect: 'follow',
			cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true }
		});
		if (!response.ok) {
			return Response.json(
				{ error: `The official site answered with HTTP ${response.status}.` },
				{ status: 502 }
			);
		}
		html = await response.text();
	} catch {
		return Response.json({ error: 'Could not reach the official site.' }, { status: 502 });
	}
	if (html.length > MAX_PAGE_BYTES) {
		return Response.json({ error: 'The official page is too large.' }, { status: 502 });
	}
	const found = await Promise.all(
		readCuratedPage(html).map(({ section, link }) => readScript(section, link))
	);
	const scripts = found.filter((s) => s !== undefined);
	return Response.json(
		{ scripts },
		{ headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` } }
	);
}
