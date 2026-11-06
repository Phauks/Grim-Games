import type { FetchedScript } from './fetch-script.ts';
import { fetchRemote } from './remote-previews.svelte.ts';
import type { LoadTarget } from './script-providers.ts';

/** A listed script that arrives as text: carried in its row, or fetched from its source. */
export type TextTarget = Exclude<LoadTarget, { kind: 'edition' } | { kind: 'saved' }>;

/** The script text of a row from Search or the script sheet, ready for the Script check. */
export function targetText(target: TextTarget): Promise<FetchedScript> {
	return target.kind === 'json'
		? Promise.resolve({ text: JSON.stringify(target.json), source: target.source })
		: fetchRemote(target);
}
