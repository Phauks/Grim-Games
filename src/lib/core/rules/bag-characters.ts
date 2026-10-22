/**
 * Which characters stay out of the bag, read from TPI's `special` data so homebrew
 * characters are covered too. Imports neither the setup check nor the bag plan, so both can
 * use it (https://wiki.bloodontheclocktower.com/Setup).
 */
import type { Character, CharacterId, Script } from '#lib/core/data/types.ts';
import type { Reminder } from '#lib/core/model/types.ts';
import { setupModifierFor } from './setup-modifiers.ts';

function hasSpecial(character: Character, type: string, name: string): boolean {
	return character.special.some((s) => s.type === type && s.name === name);
}

export function isBagDisabled(character: Character): boolean {
	return hasSpecial(character, 'selection', 'bag-disabled');
}

/**
 * The "Is The …" reminder a replace-character character leaves on its seat. Homebrew ones
 * may leave out "The" ("Is Imposter").
 */
export function replacementReminder(character: Character): Reminder | undefined {
	if (!hasSpecial(character, 'reveal', 'replace-character')) return undefined;
	const label = character.remindersGlobal.find((l) => /^is /i.test(l));
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
 *   Atheist (https://wiki.bloodontheclocktower.com/Atheist);
 * - a homebrew setup bracket that adds copies of the character itself ("[+1 Hannibal]").
 * `inPlay` is everything selected plus the Fabled and Loric in play.
 */
export function canDuplicate(character: Character, inPlay: readonly Character[]): boolean {
	if (hasSpecial(character, 'selection', 'bag-duplicate')) return true;
	if (setupModifierFor(character)?.copies?.some((n) => n > 0)) return true;
	const good = character.type === 'townsfolk' || character.type === 'outsider';
	const evil = character.type === 'minion' || character.type === 'demon';
	return inPlay.some(
		(c) =>
			(good && hasSpecial(c, 'selection', 'good-duplicate')) ||
			(evil && hasSpecial(c, 'selection', 'evil-duplicate'))
	);
}

/**
 * How a character goes in the bag, as the Storyteller sets it for a homebrew character whose
 * script leaves it out (Trevor, backlog L25: Blood on Hope's Peak's Ultimate Imposter thinks
 * it is another character, like the Drunk, but its script has no `special` data):
 * - `dealt`: its own token goes in the bag;
 * - `replaces`: no token of its own; a player secretly is it, like the Drunk;
 * - `not-dealt`: never dealt (Lil' Monsta).
 */
export type BagRole = 'dealt' | 'replaces' | 'not-dealt';

export function bagRoleOf(character: Character): BagRole {
	if (!isBagDisabled(character)) return 'dealt';
	return hasSpecial(character, 'reveal', 'replace-character') ? 'replaces' : 'not-dealt';
}

/** The character with `role`, its other `special` entries kept as they were. */
export function withBagRole(character: Character, role: BagRole): Character {
	const special = character.special.filter(
		(s) =>
			!(s.type === 'selection' && s.name === 'bag-disabled') &&
			!(s.type === 'reveal' && s.name === 'replace-character')
	);
	if (role !== 'dealt') special.push({ type: 'selection', name: 'bag-disabled' });
	if (role !== 'replaces') return { ...character, special };
	special.push({ type: 'reveal', name: 'replace-character' });
	// A seat that secretly is it is marked with an "Is …" reminder; one is added if it has none.
	const marked = character.remindersGlobal.some((l) => /^is /i.test(l));
	return {
		...character,
		special,
		remindersGlobal: marked
			? character.remindersGlobal
			: [...character.remindersGlobal, `Is The ${character.name}`]
	};
}

/** The script with its homebrew character `id` set to `role`. */
export function scriptWithBagRole(script: Script, id: CharacterId, role: BagRole): Script {
	return {
		...script,
		entries: script.entries.map((e) =>
			e.kind === 'custom' && e.character.id === id
				? { kind: 'custom', character: withBagRole(e.character, role) }
				: e
		)
	};
}
