import { loadScript, type GameData } from '#lib/core/data/index.ts';
import { withCustomCharacters, type LabData } from '#lib/core/lab/lab-game.ts';
import { savedCharacters } from '#lib/features/character-builder/stores.svelte.ts';

/**
 * The lab's characters (plan M63, Trevor 2026-11-05: "functionality available to test custom
 * characters"): the official ones, plus the characters made in the Character builder on this
 * device, read as a script's homebrew characters are, with their own jinxes.
 */
export function labData(official: GameData): LabData {
	const saved = savedCharacters.list;
	if (!saved.length) return official;
	const { script } = loadScript(
		[{ id: '_meta', name: '' }, ...saved.map((c) => c.entry)],
		official
	);
	if (!script) return official;
	const homebrew = new Set(script.homebrew);
	return withCustomCharacters(
		official,
		script.characters.filter((c) => homebrew.has(c.id)),
		script.homebrewJinxes
	);
}
