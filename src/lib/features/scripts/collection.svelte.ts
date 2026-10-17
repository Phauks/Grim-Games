/**
 * The Carousel Script Collection's scripts, fetched through our Worker only while the
 * Scripts page searches that source. The last list is kept on the device, so it is there
 * offline and the next visit shows it straight away (like `curated.svelte.ts`).
 */
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { withTimeout } from './fetch-script.ts';
import {
	CAROUSEL_COLLECTION,
	COLLECTIONS_API,
	readCollectionList,
	type CollectionScript
} from './collection-api.ts';

const STORAGE_KEY = 'grim-games.collection-carousel';

export type CollectionStatus = 'idle' | 'loading' | 'ready' | 'error';

let list = $state.raw<CollectionScript[]>([]);
let status = $state<CollectionStatus>('idle');
let restored = false;
let loading: Promise<void> | undefined;

function restore(): void {
	if (restored) return;
	restored = true;
	try {
		const saved = readCollectionList(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
		if (saved?.length) list = saved;
	} catch {
		// No storage, or an unreadable copy: fetched again when needed.
	}
}

export const collectionScripts = {
	get list(): CollectionScript[] {
		restore();
		return list;
	},
	get status(): CollectionStatus {
		return status;
	},

	/** Fetches the list once per page visit; later calls reuse it. */
	load(): Promise<void> {
		restore();
		if (status === 'ready') return Promise.resolve();
		loading ??= (async () => {
			status = 'loading';
			let response: Response;
			try {
				response = await fetch(`${COLLECTIONS_API}/${CAROUSEL_COLLECTION.id}`, {
					signal: withTimeout()
				});
			} catch {
				status = 'error';
				return;
			}
			const found = response.ok
				? readCollectionList(await response.json().catch(() => undefined))
				: undefined;
			if (!found) {
				status = 'error';
				if (response.ok)
					reportError(new Error('Script collection: unreadable answer'), {
						area: 'scripts',
						notify: false
					});
				return;
			}
			list = found;
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify({ scripts: found }));
			} catch {
				// No storage: fetched again next time.
			}
			status = 'ready';
		})().finally(() => (loading = undefined));
		return loading;
	}
};
