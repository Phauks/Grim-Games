import { scriptToJson, type LoadedScript } from '#lib/core/data/index.ts';
import { currentScript } from './current-script.svelte.ts';
import { scriptShareable, type Shareable } from './share-codes.ts';

/**
 * What a game's script links to on the Storyteller's side, as /play's does (parity): the saved
 * script when it is the game's, so it keeps its own link; otherwise the script itself. The
 * board's Script sheet and its Share screen (Trevor, 2026-10-27).
 */
export function gameShareable(script: LoadedScript): Shareable {
	const json = (s: LoadedScript) => JSON.stringify(scriptToJson(s));
	const current = currentScript.current;
	const same = current && json(current) === json(script);
	return scriptShareable(script, same ? currentScript.saved : undefined);
}
