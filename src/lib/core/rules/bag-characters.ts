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
 * A character with no token of its own in the bag that a player secretly is, marked with
 * its "Is The …" reminder once the tokens come back: the Drunk and the Marionette
 * (https://wiki.bloodontheclocktower.com/Drunk, https://wiki.bloodontheclocktower.com/Marionette).
 */
export function isReplacedAfterDraw(character: Character): boolean {
	return isBagDisabled(character) && replacementReminder(character) !== undefined;
}

/**
 * A selected character that is never dealt: bag-disabled with no stand-in (Lil' Monsta).
 * Its setup change still applies.
 */
export function isNotDealt(character: Character): boolean {
	return isBagDisabled(character) && !replacementReminder(character);
}

/**
 * Whether more than one copy of `character` may go in the bag, from TPI's `special` data:
 * - `bag-duplicate` on the character itself: the Village Idiot
 *   (https://wiki.bloodontheclocktower.com/Village_Idiot) and Legion
 *   (https://wiki.bloodontheclocktower.com/Legion);
 * - `good-duplicate` / `evil-duplicate` on a character in play, which lets good or evil
 *   characters repeat: the Pope (https://wiki.bloodontheclocktower.com/Pope) and the
 *   Atheist (https://wiki.bloodontheclocktower.com/Atheist).
 * `inPlay` is everything selected plus the Fabled and Loric in play.
 */
export function canDuplicate(character: Character, inPlay: readonly Character[]): boolean {
	if (hasSpecial(character, 'selection', 'bag-duplicate')) return true;
	const good = character.type === 'townsfolk' || character.type === 'outsider';
	const evil = character.type === 'minion' || character.type === 'demon';
	return inPlay.some(
		(c) =>
			(good && hasSpecial(c, 'selection', 'good-duplicate')) ||
			(evil && hasSpecial(c, 'selection', 'evil-duplicate'))
	);
}
