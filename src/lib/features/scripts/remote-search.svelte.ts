/**
 * One remote provider's search results, page by page (`script-providers.ts`). A new search
 * cancels the one before it, so a slow answer never replaces a newer one.
 */
import type { GameData } from '#lib/core/data/index.ts';
import { errorMessage } from '#lib/features/errors/app-error.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { ScriptFetchError } from './fetch-script.ts';
import type { RemoteProvider, ScriptListing } from './script-providers.ts';

export class RemoteSearch<Query> {
	listings = $state.raw<ScriptListing[]>([]);
	count = $state(0);
	page = $state(0);
	hasMore = $state(false);
	loading = $state(false);
	failure = $state('');
	/** The key of the search the listings answer; undefined before the first one. */
	searched = $state<string | undefined>(undefined);
	#controller: AbortController | undefined;

	constructor(
		readonly provider: RemoteProvider<Query>,
		readonly keyOf: (query: Query) => string
	) {}

	async load(query: Query, page: number, data: GameData): Promise<void> {
		this.#controller?.abort();
		const mine = new AbortController();
		this.#controller = mine;
		this.loading = true;
		this.failure = '';
		try {
			const found = await this.provider.search(query, page, data, mine.signal);
			if (this.#controller !== mine) return;
			this.listings = page === 1 ? found.listings : [...this.listings, ...found.listings];
			this.count = found.count;
			this.page = found.page;
			this.hasMore = found.hasMore;
			this.searched = this.keyOf(query);
		} catch (e) {
			if (e instanceof DOMException && e.name === 'AbortError') return;
			// The site being down or refusing is expected; anything else is a bug worth logging.
			if (!(e instanceof ScriptFetchError)) reportError(e, { area: 'scripts', notify: false });
			this.failure = errorMessage(e);
			if (page === 1) this.listings = [];
		} finally {
			if (this.#controller === mine) this.loading = false;
		}
	}

	abort(): void {
		this.#controller?.abort();
	}
}
