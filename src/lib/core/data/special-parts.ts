/**
 * TPI `special` hooks read as rules parts (M58, P7). Scripts written in other tools describe
 * some behaviour only with these hooks, while our official characters use parts for the same
 * thing, so a custom character's hook becomes the matching part when its own `rules` don't
 * already have one:
 *
 * - `vote` / `multiplier` with a number: `voteWeight` for the player carrying its one reminder
 *   (the Thief, the Bureaucrat);
 * - `vote` / `hidden`: `voting.secret` (the Organ Grinder);
 * - `player` / `open-eyes` at night: `wakesWithEvil` (the Wraith).
 *
 * Other hooks stay as they are: they are read where they are used, or only add a day reminder.
 */
import type { CharacterRules } from './character-rules.ts';
import type { Character } from './types.ts';

export function withSpecialParts(character: Character): Character {
	const rules: CharacterRules = { ...character.rules };
	for (const s of character.special) {
		const value = Number(s.value);
		if (s.type === 'vote' && s.name === 'multiplier' && !rules.voteWeight) {
			const own = [...new Set(character.reminders)];
			if (own.length === 1 && Number.isInteger(value) && value !== 1)
				rules.voteWeight = { reminder: own[0], weight: value };
		}
		if (s.type === 'vote' && s.name === 'hidden' && !rules.voting?.secret)
			rules.voting = { ...rules.voting, secret: true };
		if (s.name === 'open-eyes' && (s.time === undefined || s.time === 'night'))
			rules.wakesWithEvil ??= true;
	}
	const added = Object.keys(rules).length > Object.keys(character.rules ?? {}).length;
	const changed = added || rules.voting !== character.rules?.voting;
	return changed ? { ...character, rules } : character;
}
