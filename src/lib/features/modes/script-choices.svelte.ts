/**
 * Scripts a game mode can be played with, chosen the same way as on New game's Standard tab:
 * the official editions, the script last played from Search, and recent custom scripts. A
 * mode with its own scripts (Two Towns) loads them from their links instead.
 */
import {
	editionScript,
	loadScript,
	OFFICIAL_EDITIONS,
	type GameData,
	type LoadedScript
} from '#lib/core/data/index.ts';
import type { SourceLink } from '#lib/core/modes/index.ts';
import { fetchLinkTarget } from '#lib/features/scripts/fetch-script.ts';
import { resolveLink } from '#lib/features/scripts/script-links.ts';
import {
	QUICK_PLAY_ID,
	quickPlayScript,
	recentScripts
} from '#lib/features/scripts/current-script.svelte.ts';
import { reloadSavedScript } from '#lib/features/scripts/saved-scripts.ts';

export type ScriptChoice = string;

export function scriptChoices(): { value: ScriptChoice; label: string }[] {
	const quick = quickPlayScript.saved;
	return [
		...OFFICIAL_EDITIONS.map((e) => ({ value: e.id as string, label: e.name })),
		...(quick ? [{ value: `recent:${QUICK_PLAY_ID}`, label: quick.name }] : []),
		...recentScripts.list
			.filter((s) => !s.edition)
			.slice(0, 3)
			.map((s) => ({ value: `recent:${s.scriptId}`, label: s.name }))
	];
}

export function loadScriptChoice(choice: ScriptChoice, data: GameData): LoadedScript {
	const quick = quickPlayScript.saved;
	const recent = choice.startsWith('recent:')
		? [...(quick ? [quick] : []), ...recentScripts.list].find(
				(s) => `recent:${s.scriptId}` === choice
			)
		: undefined;
	const loaded = recent ? reloadSavedScript(recent, data) : editionScript(choice, data);
	if (!loaded) throw new Error('the chosen script could not be loaded');
	return loaded;
}

/** A mode's own script, from its link (BotC Scripts through our Worker). */
export async function loadLinkedScript(link: SourceLink, data: GameData): Promise<LoadedScript> {
	const fetched = await fetchLinkTarget(resolveLink(link.url), link.url);
	const result = loadScript(JSON.parse(fetched.text), data);
	if (!result.script) throw new Error(`${link.title} could not be loaded`);
	return result.script;
}
