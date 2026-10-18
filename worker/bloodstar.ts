/**
 * Bloodstar Clocktica for Search (`bloodstar-api.ts`). The browser can't read the site itself
 * (its code sends no CORS headers).
 * - `/api/bloodstar`: the list of published scripts, served from our own copy (`mirror.ts`),
 *   which asks the site for that one list at most once a day.
 * - `/api/bloodstar/<user>/<edition>`: one script's JSON, fetched when it is opened and
 *   cached. Not an open proxy: only `/p/<user>/<edition>/script.json` on the site, with
 *   folder names in the site's own format.
 */
import {
	BLOODSTAR_ORIGIN,
	bloodstarScriptUrl,
	isBloodstarFolder,
	readAllPublished
} from '../src/lib/features/scripts/bloodstar-api.ts';
import type { MirroredSource } from './mirror.ts';
import { USER_AGENT } from './user-agent.ts';

const CACHE_SECONDS = 3600;
/** The list is paths only: a few hundred kilobytes for thousands of scripts. */
const MAX_LIST_BYTES = 8_000_000;
/** A script with its characters' images inline (`data:` URLs) can be large. */
const MAX_SCRIPT_BYTES = 1_000_000;

export const bloodstarSource: MirroredSource = {
	id: 'bloodstar',
	async build() {
		const started = Date.now();
		const response = await fetch(`${BLOODSTAR_ORIGIN}/api/allpublished.php`, {
			headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
			redirect: 'follow'
		});
		if (!response.ok) throw new Error(`Bloodstar answered with HTTP ${response.status}.`);
		const body = await response.text();
		if (body.length > MAX_LIST_BYTES) throw new Error('The Bloodstar list is too large.');
		let json: unknown;
		try {
			json = JSON.parse(body);
		} catch {
			throw new Error('Bloodstar did not return JSON.');
		}
		const scripts = readAllPublished(json);
		if (!scripts.length) throw new Error('Bloodstar listed no scripts.');
		// For the spike's numbers: how long the site took and how big its answer was.
		return { scripts, upstreamMs: Date.now() - started, upstreamBytes: body.length };
	}
};

function decode(part: string): string | undefined {
	try {
		return decodeURIComponent(part);
	} catch {
		return undefined;
	}
}

export async function handleBloodstarScript(url: URL): Promise<Response> {
	const match = url.pathname.match(/^\/api\/bloodstar\/([^/]+)\/([^/]+)$/);
	const user = match && decode(match[1]);
	const edition = match && decode(match[2]);
	if (!user || !edition || !isBloodstarFolder(user) || !isBloodstarFolder(edition)) {
		return new Response('Not found', { status: 404 });
	}
	try {
		const response = await fetch(bloodstarScriptUrl({ user, edition }), {
			headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
			redirect: 'follow',
			cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true }
		});
		if (response.status === 404) return new Response('Not found', { status: 404 });
		if (!response.ok) throw new Error(`Bloodstar answered with HTTP ${response.status}.`);
		const body = await response.text();
		if (body.length > MAX_SCRIPT_BYTES) throw new Error('The script is too large.');
		const script: unknown = JSON.parse(body);
		if (!Array.isArray(script)) throw new Error('The script is not in the script format.');
		return Response.json(script, {
			headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` }
		});
	} catch (e) {
		const message = e instanceof SyntaxError ? 'Bloodstar did not return JSON.' : String(e);
		console.warn('bloodstar', message);
		return Response.json({ error: 'Could not read the script from Bloodstar.' }, { status: 502 });
	}
}
