/**
 * The official site's curated scripts, fetched only when the picker needs them (the Curated
 * source is chosen, or a search is typed), and kept on the device (cached-list.svelte.ts).
 */
import { CachedList } from './cached-list.svelte.ts';
import { CURATED_API, readCuratedList, type CuratedScript } from './curated-api.ts';

export const curatedScripts = new CachedList<CuratedScript>({
	key: 'grim-games.curated-scripts',
	url: CURATED_API,
	read: readCuratedList,
	name: 'Curated scripts'
});
