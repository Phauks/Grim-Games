/**
 * The BOTC HomeBrew Wiki's scripts, fetched only while Search shows that source, and kept on
 * the device (cached-list.svelte.ts).
 */
import { CachedList } from './cached-list.svelte.ts';
import {
	HOMEBREW_SCRIPTS_API,
	readHomebrewList,
	type HomebrewScript
} from './homebrew-scripts-api.ts';

export const homebrewScripts = new CachedList<HomebrewScript>({
	key: 'grim-games.homebrew-scripts',
	url: HOMEBREW_SCRIPTS_API,
	read: readHomebrewList,
	name: 'Homebrew Wiki scripts',
	emptyIsBroken: true
});
