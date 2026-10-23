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

let followed = $state.raw<{ code: string; script: LoadedScript }>();

/**
 * The script room `code` sent this phone, once it has (plan J1, Trevor 2026-10-22): a join
 * screen shows nothing from the device, such as the last script used, until then.
 */
export function roomScript(code: string | undefined): LoadedScript | undefined {
	return code && followed?.code === code ? followed.script : undefined;
}

/** Loads `script`, sent by room `code`, and makes it current, unless it already is. */
export async function followRoomScript(
	script: Script,
	code: string
): Promise<LoadedScript | undefined> {
	const [data] = await Promise.all([loadOfficialData(), restoreScripts()]);
	const { script: loaded } = fromScript(script, data);
	if (loaded.characters.length === 0) return undefined;
	const current = currentScript.current;
	if (current && sameScript(current, loaded)) {
		followed = { code, script: current };
		return current;
	}
	await chooseScript(loaded, { kind: 'share' });
	followed = { code, script: loaded };
	return loaded;
}
