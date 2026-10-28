/**
 * The Carousel Script Collection's scripts, fetched only while the Scripts page searches that
 * source, and kept on the device (cached-list.svelte.ts).
 */
import { CachedList } from './cached-list.svelte.ts';
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

export const collectionScripts = new CachedList<CollectionScript>({
	key: 'grim-games.collection-carousel',
	url: `${COLLECTIONS_API}/${CAROUSEL_COLLECTION.id}`,
	read: readCollectionList,
	name: 'Script collection',
	emptyIsBroken: true,
	timeoutMs: FIRST_COPY_TIMEOUT_MS
});
