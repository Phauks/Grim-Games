/**
 * Scripts fetched for a script's details, from BotC Scripts, the BOTC HomeBrew Wiki or
 * Bloodstar Clocktica through our Worker: once per page visit per script and version, shared by every view of a
 * script (Search, the Library) and by Save, so a script shown then saved is only asked for
 * once.
 */
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { BotcScriptsRef } from './botcscripts-api.ts';
import {
	fetchBloodstarScript,
	fetchHomebrewScript,
	fetchLinkTarget,
	type FetchedScript
} from './fetch-script.ts';
import type { LoadTarget } from './script-providers.ts';

/** The rows whose script is fetched when shown. */
export type RemoteTarget = Extract<LoadTarget, { kind: 'botcscripts' | 'homebrew' | 'bloodstar' }>;

const fetches = new SvelteMap<string, Promise<FetchedScript>>();
const fetched = new SvelteMap<string, FetchedScript>();
/** Scripts whose fetch failed: their details fall back to the character badges. */
const failed = new SvelteSet<string>();

function keyOf(target: RemoteTarget): string {
	switch (target.kind) {
		case 'botcscripts':
			return `botc:${JSON.stringify(target.ref)}`;
		case 'homebrew':
			return `homebrew:${target.slug}`;
		case 'bloodstar':
			return `bloodstar:${target.script.user}/${target.script.edition}`;
	}
}

export function fetchRemote(target: RemoteTarget): Promise<FetchedScript> {
	const key = keyOf(target);
	let fetching = fetches.get(key);
	if (!fetching) {
		failed.delete(key);
		fetching =
			target.kind === 'botcscripts'
				? fetchLinkTarget({ kind: 'botcscripts', ref: target.ref }, '')
				: target.kind === 'homebrew'
					? fetchHomebrewScript(target.slug)
					: fetchBloodstarScript(target.script);
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

export function fetchBotc(ref: BotcScriptsRef): Promise<FetchedScript> {
	return fetchRemote({ kind: 'botcscripts', ref });
}

export function isRemote(target: LoadTarget | undefined): target is RemoteTarget {
	return (
		target?.kind === 'botcscripts' || target?.kind === 'homebrew' || target?.kind === 'bloodstar'
	);
}

export const remotePreviews = {
	/** The fetched script, once it has arrived. */
	get(target: RemoteTarget): FetchedScript | undefined {
		return fetched.get(keyOf(target));
	},
	failed(target: RemoteTarget): boolean {
		return failed.has(keyOf(target));
	}
};
