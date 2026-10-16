import { SvelteMap } from 'svelte/reactivity';
import { parseWikiPage, type WikiSection } from './wiki-page.ts';

/**
 * A character's whole wiki page, shown when the character is opened (Trevor, 2026-10-16).
 * As with the Glossary (CLAUDE.md), the wiki's text is never bundled: it is fetched live from
 * the wiki's API on this device and kept in browser storage (the most recent pages only) so
 * it still works offline. Without either, the dialog shows only the "Open wiki" link.
 */
const WIKI_API = 'https://wiki.bloodontheclocktower.com/api.php';
const KEY = 'grim-games:wiki-pages';
/** Fetched again after this long, when online. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Pages kept on the device; the least recently fetched go first. */
const KEEP = 40;

export type WikiPageState =
	{ status: 'loading' } | { status: 'ready'; sections: WikiSection[] } | { status: 'unavailable' };

interface Cached {
	fetchedAt: number;
	sections: WikiSection[];
}

function apiUrl(title: string): string {
	const params = new URLSearchParams({
		action: 'parse',
		page: title,
		prop: 'text',
		redirects: '1',
		format: 'json',
		formatversion: '2',
		disableeditsection: '1',
		disablelimitreport: '1',
		origin: '*'
	});
	return `${WIKI_API}?${params}`;
}

function readCache(): Record<string, Cached> {
	try {
		const raw = globalThis.localStorage?.getItem(KEY);
		const parsed = raw ? (JSON.parse(raw) as Record<string, Cached>) : {};
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

function writeCache(title: string, entry: Cached) {
	try {
		const all = { ...readCache(), [title]: entry };
		const kept = Object.entries(all)
			.sort(([, a], [, b]) => b.fetchedAt - a.fetchedAt)
			.slice(0, KEEP);
		globalThis.localStorage?.setItem(KEY, JSON.stringify(Object.fromEntries(kept)));
	} catch {
		// Not kept; it is fetched again next time.
	}
}

class WikiPages {
	#pages = new SvelteMap<string, WikiPageState>();
	#loading = new Map<string, Promise<void>>();

	/** The page's state; call `load` first. */
	get(title: string): WikiPageState {
		return this.#pages.get(title) ?? { status: 'loading' };
	}

	/** Shows the cached copy at once, then fetches a fresh one when it is missing or old. */
	load(title: string, fetcher: typeof fetch = fetch): Promise<void> {
		const running = this.#loading.get(title);
		if (running) return running;
		const cached = readCache()[title];
		if (cached?.sections?.length)
			this.#pages.set(title, { status: 'ready', sections: cached.sections });
		if (cached && Date.now() - cached.fetchedAt < MAX_AGE_MS) return Promise.resolve();
		const promise = (async () => {
			try {
				const response = await fetcher(apiUrl(title));
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const body = (await response.json()) as { parse?: { text?: string } };
				const sections = body.parse?.text ? parseWikiPage(body.parse.text) : [];
				if (sections.length === 0) throw new Error('empty page');
				this.#pages.set(title, { status: 'ready', sections });
				writeCache(title, { fetchedAt: Date.now(), sections });
			} catch {
				// Offline, blocked or no such page: keep the cached copy, else the link only.
				if (this.#pages.get(title)?.status !== 'ready')
					this.#pages.set(title, { status: 'unavailable' });
			} finally {
				this.#loading.delete(title);
			}
		})();
		this.#loading.set(title, promise);
		return promise;
	}
}

export const wikiPages = new WikiPages();
