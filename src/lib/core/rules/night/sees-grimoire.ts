/**
 * Whether a character's player looks at the Grimoire at night (the Spy each night, the Widow on
 * the first, https://wiki.bloodontheclocktower.com/Spy and /Widow). Read from TPI's `special`
 * data (`signal: grimoire`, botc-release README) so homebrew characters are covered too; the
 * night step then offers to show the board to that player.
 */
import type { Character } from '#lib/core/data/types.ts';

export function seesGrimoire(character: Character): boolean {
	return character.special.some((s) => s.type === 'signal' && s.name === 'grimoire');
}
