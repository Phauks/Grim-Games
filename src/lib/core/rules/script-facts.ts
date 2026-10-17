/**
 * Factual checks of a script, shown when it is previewed and in the setup check (Trevor,
 * 2026-10-16: approved from the Ravenswood Studio review, ideas only). Everything comes from
 * TPI's data and our setup tables, never our own judgement of balance:
 * - how many characters of each type the script has;
 * - the jinxed pairs on it (TPI's jinxes plus any the script's homebrew characters declare);
 *   no separate Djinn fact (Trevor, 2026-10-17: the pairs are enough);
 * - the characters that change setup (`setupModifierFor`), such as the Baron;
 * - characters that need another character in play ("requires": the Choirboy needs the King,
 *   https://wiki.bloodontheclocktower.com/Choirboy), and whether that one is on the script.
 */
import type { JinxIndex } from '#lib/core/data/jinxes.ts';
import {
	CHARACTER_TYPES,
	type Character,
	type CharacterId,
	type CharacterType,
	type Jinx
} from '#lib/core/data/types.ts';
import { scriptJinxes, type ScriptJinx } from './jinxes.ts';
import { setupModifierFor, type SetupModifier } from './setup-modifiers.ts';

export interface ScriptRequirement {
	/** The character that needs another in play. */
	id: CharacterId;
	requires: CharacterId;
	/** False when the required character isn't on the script, so it can't be put in play. */
	onScript: boolean;
}

export interface ScriptFacts {
	counts: Record<CharacterType, number>;
	jinxes: ScriptJinx[];
	/** Characters on the script that change setup, in script order. */
	modifiers: SetupModifier[];
	requirements: ScriptRequirement[];
}

export function scriptFacts(
	characters: readonly Character[],
	jinxIndex: JinxIndex,
	homebrewJinxes: readonly Jinx[] = []
): ScriptFacts {
	const counts = Object.fromEntries(CHARACTER_TYPES.map((t) => [t, 0])) as Record<
		CharacterType,
		number
	>;
	for (const c of characters) counts[c.type] += 1;

	const byName = new Map(characters.map((c) => [c.name.toLowerCase(), c.id]));
	const ids = new Set(characters.map((c) => c.id));
	const modifiers = characters.flatMap((c) => {
		const modifier = setupModifierFor(c, (name) => byName.get(name.toLowerCase()));
		return modifier ? [modifier] : [];
	});
	const jinxes = scriptJinxes(jinxIndex, ids, homebrewJinxes);
	return {
		counts,
		jinxes,
		modifiers,
		requirements: modifiers.flatMap((m) =>
			m.requires ? [{ id: m.id, requires: m.requires, onScript: ids.has(m.requires) }] : []
		)
	};
}
