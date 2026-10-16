/**
 * Makes the script a room sends the phone's current script, so /play shows the game's
 * script as soon as the phone joins, before anyone has a seat.
 */
import { fromScript, scriptToJson, type LoadedScript, type Script } from '#lib/core/data/index.ts';
import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
import {
	chooseScript,
	currentScript,
	restoreScripts
} from '#lib/features/scripts/current-script.svelte.ts';

const sameScript = (a: LoadedScript, b: LoadedScript) =>
	JSON.stringify(scriptToJson(a)) === JSON.stringify(scriptToJson(b));

/** Loads `script` and makes it current, unless it already is. */
export async function followRoomScript(script: Script): Promise<LoadedScript | undefined> {
	const [data] = await Promise.all([loadOfficialData(), restoreScripts()]);
	const { script: loaded } = fromScript(script, data);
	if (loaded.characters.length === 0) return undefined;
	const current = currentScript.current;
	if (current && sameScript(current, loaded)) return current;
	await chooseScript(loaded, { kind: 'share' });
	return loaded;
}
