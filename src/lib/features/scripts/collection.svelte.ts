/**
 * The Carousel Script Collection's scripts, fetched through our Worker only while the
 * Scripts page searches that source. The last list is kept on the device, so it is there
 * offline and the next visit shows it straight away (like `curated.svelte.ts`).
 */
import { reportError } from '#lib/features/errors/report.svelte.ts';
import {
	CAROUSEL_COLLECTION,
	COLLECTIONS_API,
	readCollectionList,
	type CollectionScript
} from './collection-api.ts';

/**
 * The Worker's first copy fetches every script file from Google Drive before answering;
 * later answers come straight from its copy.
 */
const FIRST_COPY_TIMEOUT_MS = 45_000;

const STORAGE_KEY = 'grim-games.collection-carousel';

export type CollectionStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * The copy kept on the device, read once when the module loads: reading it lazily from the
 * list's getter wrote state while a derived value was being worked out (Trevor, 2026-10-19).
 */
function restored(): CollectionScript[] {
	try {
		return readCollectionList(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')) ?? [];
	} catch {
		// No storage, or an unreadable copy: fetched again when needed.
		return [];
	}
}

let list = $state.raw<CollectionScript[]>(restored());
let status = $state<CollectionStatus>('idle');
let loading: Promise<void> | undefined;

export const collectionScripts = {
	get list(): CollectionScript[] {
		return list;
	},
	get status(): CollectionStatus {
		return status;
	},

	/** Fetches the list once per page visit; later calls reuse it. */
	load(): Promise<void> {
		if (status === 'ready') return Promise.resolve();
		loading ??= (async () => {
			status = 'loading';
			let response: Response;
			try {
				response = await fetch(`${COLLECTIONS_API}/${CAROUSEL_COLLECTION.id}`, {
					signal: AbortSignal.timeout(FIRST_COPY_TIMEOUT_MS)
				});
			} catch {
				status = 'error';
				return;
			}
			const found = response.ok
				? readCollectionList(await response.json().catch(() => undefined))
				: undefined;
			// An empty list is a broken source, not an empty collection: keep the last one.
			if (!found?.length) {
				status = 'error';
				if (response.ok && !found)
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
