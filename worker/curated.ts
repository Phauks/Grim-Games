/**
 * `/api/curated`: the scripts TPI lists on its Scripts page, for Search's Official Custom
 * Scripts and Scripts of the Month. The browser can't read that page itself (no CORS). Served
 * from our own copy (`mirror.ts`), which fetches only that one page; the scripts are decoded
 * from their Script Tool links here, so nothing else is requested. Design: 08 §5.6.
 */
import {
	CURATED_PAGE,
	mergeCurated,
	readCuratedList,
	type CuratedScript
} from '../src/lib/features/scripts/curated-api.ts';
import {
	decodeScriptToolPayload,
	readCuratedPage,
	scriptToolPayload
} from '../src/lib/features/scripts/script-tool-link.ts';
import { USER_AGENT } from './user-agent.ts';
import type { MirroredSource } from './mirror.ts';

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

/** The page's scripts, merged with our copy's past Scripts of the Month (`mirror.ts`). */
export const curatedSource: MirroredSource = {
	id: 'curated',
	async build(previous) {
		const response = await fetch(CURATED_PAGE, {
			headers: { Accept: 'text/html', 'User-Agent': USER_AGENT },
			redirect: 'follow'
		});
		if (!response.ok) throw new Error(`The official site answered with HTTP ${response.status}.`);
		const html = await response.text();
		if (html.length > MAX_PAGE_BYTES) throw new Error('The official page is too large.');
		const found = await Promise.all(
			readCuratedPage(html).map(({ section, link }) => readScript(section, link))
		);
		const scripts = found.filter((s) => s !== undefined);
		if (!scripts.length) throw new Error('The official page listed no scripts we could read.');
		const month = new Date().toISOString().slice(0, 7);
		return { scripts: mergeCurated(readCuratedList(previous) ?? [], scripts, month) };
	}
};
