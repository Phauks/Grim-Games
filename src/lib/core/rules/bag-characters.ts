/**
 * Which characters stay out of the bag, read from TPI's `special` data so homebrew
 * characters are covered too. No imports from other rules files, so both the setup check
 * and the bag plan can use it (https://wiki.bloodontheclocktower.com/Setup).
 */
import type { Character } from '#lib/core/data/types.ts';
import type { Reminder } from '#lib/core/model/types.ts';

function hasSpecial(character: Character, type: string, name: string): boolean {
	return character.special.some((s) => s.type === type && s.name === name);
}

export function isBagDisabled(character: Character): boolean {
	return hasSpecial(character, 'selection', 'bag-disabled');
}

/** The "Is The …" reminder a replace-character character leaves on its seat. */
export function replacementReminder(character: Character): Reminder | undefined {
	if (!hasSpecial(character, 'reveal', 'replace-character')) return undefined;
	const label = character.remindersGlobal.find((l) => /^is the /i.test(l));
	return label ? { characterId: character.id, label } : undefined;
}

/**
 * A selected character that is never dealt: bag-disabled with no stand-in (Lil' Monsta).
 * Its setup change still applies.
 */
export function isNotDealt(character: Character): boolean {
	return isBagDisabled(character) && !replacementReminder(character);
}
