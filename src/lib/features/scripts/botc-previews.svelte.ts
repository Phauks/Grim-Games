/**
 * BotC Scripts scripts fetched for a script's details, through our Worker: once per page
 * visit per script and version, shared by every view of a script (Search, the Library) and
 * by Save, so a script shown then saved is only asked for once.
 */
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { BotcScriptsRef } from './botcscripts-api.ts';
import { fetchLinkTarget, type FetchedScript } from './fetch-script.ts';

const fetches = new SvelteMap<string, Promise<FetchedScript>>();
const fetched = new SvelteMap<string, FetchedScript>();
/** Refs whose fetch failed: their details fall back to the character badges. */
const failed = new SvelteSet<string>();

const keyOf = (ref: BotcScriptsRef) => JSON.stringify(ref);

export function fetchBotc(ref: BotcScriptsRef): Promise<FetchedScript> {
	const key = keyOf(ref);
	let fetching = fetches.get(key);
	if (!fetching) {
		failed.delete(key);
		fetching = fetchLinkTarget({ kind: 'botcscripts', ref }, '');
		fetches.set(key, fetching);
		fetching.then(
			(result) => fetched.set(key, result),
			() => {
				fetches.delete(key);
				failed.add(key);
			}
		);
	}
	return fetching;
}

export const botcPreviews = {
	/** The fetched script, once it has arrived. */
	get(ref: BotcScriptsRef): FetchedScript | undefined {
		return fetched.get(keyOf(ref));
	},
	failed(ref: BotcScriptsRef): boolean {
		return failed.has(keyOf(ref));
	}
};
