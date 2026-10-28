/**
 * A script's own rules and the Fabled and Loric it brings into a game.
 *
 * - Script rules are the Bootlegger lines in `_meta.bootlegger` (TPI's `script-schema.json`).
 *   The Bootlegger is the Loric that says a script has homebrew characters or rules
 *   (https://wiki.bloodontheclocktower.com/Bootlegger), so its ability shows the script's own
 *   lines in place of TPI's sentence. Every Script World Cup 2025 finalist carries its rule this
 *   way (https://botc-script-viewer.sthom.kiwi/wc25/), and some split one rule over two lines,
 *   so the lines are joined with a space.
 * - A game starts with the script's Fabled and Loric in play, plus the Bootlegger when the
 *   script has rules (Trevor, 2026-10-18). A `jinxesOnly` character (the Djinn) is left out: the
 *   app never mentions it, since jinxes show on their own (Trevor, 2026-10-17).
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { Character, CharacterId, Script, ScriptMeta } from '#lib/core/data/types.ts';

export const BOOTLEGGER: CharacterId = 'bootlegger';

/** The script's Bootlegger lines, trimmed, without empty ones. */
export function scriptRules(meta: ScriptMeta | undefined): string[] {
	return (meta?.bootlegger ?? []).map((line) => line.trim()).filter((line) => line !== '');
}

/** The Bootlegger as this script shows it: its ability is the script's rules, if any. */
export function bootleggerWithRules(bootlegger: Character, rules: readonly string[]): Character {
	return rules.length ? { ...bootlegger, ability: rules.join(' ') } : bootlegger;
}

/**
 * A script's character list as players read it: the Bootlegger shows the script's rules, and
 * is added at the end when the script has rules but doesn't list it. `bootlegger` is TPI's.
 */
export function withScriptRules(
	characters: readonly Character[],
	meta: ScriptMeta | undefined,
	bootlegger: Character | undefined
): Character[] {
	const rules = scriptRules(meta);
	if (!rules.length) return [...characters];
	const listed = characters.some((c) => c.id === BOOTLEGGER);
	const shown = characters.map((c) => (c.id === BOOTLEGGER ? bootleggerWithRules(c, rules) : c));
	return listed || !bootlegger ? shown : [...shown, bootleggerWithRules(bootlegger, rules)];
}

/**
 * The Fabled and Loric a new game starts with, in script order: those on the script, then
 * the Bootlegger if the script has rules and doesn't list it. `characters` is the game's
 * lookup (official characters plus the script's homebrew ones).
 */
export function startingRuleCharacters(
	script: Script,
	characters: ReadonlyMap<CharacterId, Character>
): CharacterId[] {
	const ids: CharacterId[] = [];
	for (const entry of script.entries) {
		const character = entry.kind === 'official' ? characters.get(entry.id) : entry.character;
		if (!character || ids.includes(character.id)) continue;
		if (rulesOf(character.id, characters)?.jinxesOnly) continue;
		if (character.type === 'fabled' || character.type === 'loric') ids.push(character.id);
	}
	if (scriptRules(script.meta).length && !ids.includes(BOOTLEGGER) && characters.has(BOOTLEGGER)) {
		ids.push(BOOTLEGGER);
	}
	return ids;
}
