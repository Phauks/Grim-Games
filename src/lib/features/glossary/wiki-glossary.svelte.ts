import { parseGlossaryHtml, glossaryKey, type WikiEntry } from './wiki-glossary.ts';

/**
 * The wiki Glossary's own definitions, shown word for word (Trevor, 2026-10-15: "glossary
 * definition must match the glossary in the wiki, no deviation"). The wiki has no content
 * licence, so the text is never bundled: it is fetched live from the wiki's API on this
 * device and kept in browser storage so it still works offline. When neither is available
 * the popover shows only the term and the Glossary link. To be revisited before any
 * public launch.
 */
const API =
	'https://wiki.bloodontheclocktower.com/api.php?action=parse&page=Glossary&prop=text' +
	'&format=json&formatversion=2&disableeditsection=1&disablelimitreport=1&origin=*';
// v2 keeps the links in each entry ("see …").
const KEY = 'grim-games:wiki-glossary:v2';
/** Fetched again after this long, when online. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface Cached {
	fetchedAt: number;
	entries: [string, WikiEntry][];
}

function readCache(): Cached | undefined {
	try {
		globalThis.localStorage?.removeItem('grim-games:wiki-glossary'); // v1, without links
		const raw = globalThis.localStorage?.getItem(KEY);
		const parsed = raw ? (JSON.parse(raw) as Cached) : undefined;
		return parsed && Array.isArray(parsed.entries) ? parsed : undefined;
	} catch {
		return undefined;
	}
}

class WikiGlossary {
	#entries = $state<ReadonlyMap<string, WikiEntry>>(new Map());
	#loading: Promise<void> | undefined;
	#fetchedAt = 0;

	/** The wiki's entry for a Glossary term, if it has been fetched. */
	definition(term: string): WikiEntry | undefined {
		return this.#entries.get(glossaryKey(term));
	}

	/** Every fetched entry, by `glossaryKey`. */
	get entries(): ReadonlyMap<string, WikiEntry> {
		return this.#entries;
	}

	/** Loads the cached copy, then fetches a fresh one when it is missing or old. */
	load(fetcher: typeof fetch = fetch): Promise<void> {
		if (this.#loading) return this.#loading;
		const cached = readCache();
		if (cached) {
			this.#entries = new Map(cached.entries);
			this.#fetchedAt = cached.fetchedAt;
		}
		if (Date.now() - this.#fetchedAt < MAX_AGE_MS) return (this.#loading = Promise.resolve());
		this.#loading = (async () => {
			try {
				const response = await fetcher(API);
				if (!response.ok) return;
				const body = (await response.json()) as { parse?: { text?: string } };
				const entries = body.parse?.text ? parseGlossaryHtml(body.parse.text) : new Map();
				if (entries.size === 0) return;
				this.#entries = entries;
				this.#fetchedAt = Date.now();
				try {
					globalThis.localStorage?.setItem(
						KEY,
						JSON.stringify({ fetchedAt: this.#fetchedAt, entries: [...entries] } satisfies Cached)
					);
				} catch {
					// Not kept; it is fetched again next time.
				}
			} catch {
				// Offline or blocked: keep the cached copy (or none) and show the link only.
			} finally {
				this.#loading = undefined;
				// Try again later in this session only if nothing was loaded.
				if (this.#entries.size > 0) this.#loading = Promise.resolve();
			}
		})();
		return this.#loading;
	}
}

export const wikiGlossary = new WikiGlossary();
