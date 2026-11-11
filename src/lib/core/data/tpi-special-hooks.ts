/**
 * TPI `special` hooks read as rules parts (M58, P7). Scripts written in other tools describe
 * some behaviour only with these hooks, while our official characters use parts for the same
 * thing, so a custom character's hook becomes the matching part when its own `rules` don't
 * already have one:
 *
 * - `vote` / `multiplier` with a number: `voteWeight` for the player carrying its one reminder
 *   (the Thief, the Bureaucrat);
 * - `vote` / `hidden`: `voting.secret` (the Organ Grinder);
 * - `player` / `open-eyes` at night: `wakesWithEvil` (the Wraith);
 * - `ability` / `distribute-roles` before the game, with no [brackets] of its own: a
 *   `setupModifier` that says the Storyteller gives out the characters, with no bag (the
 *   Gardener's).
 *
 * The rest are read where they are used (the bag hooks, `replace-character`, `grimoire`), or
 * describe something done at the table, which the app leaves to the table (votes, pointing:
 * Trevor, 2026-11-01), so they add the same day reminder the official characters with them
 * have (`detectDayReminders`).
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
		if (s.name === 'distribute-roles' && !character.setup)
			rules.setupModifier ??= {
				summary: 'Storyteller assigns characters',
				ops: [],
				notes: ['No bag: the Storyteller chooses each player’s character.']
			};
	}
	const added = Object.keys(rules).length > Object.keys(character.rules ?? {}).length;
	const changed = added || rules.voting !== character.rules?.voting;
	return changed ? { ...character, rules } : character;
}
