import { SPECIAL_RULE_FORMAT, type SpecialRule } from '../types.ts';

/**
 * Duplicate Characters (Trevor's own rule, 2026-10-24): the bag may hold more than one copy
 * of a character, as Whale Buffet allows, on any script. Character selection lets any
 * character be chosen more than once, and a second seat with the same character is not
 * flagged. Demons keep one copy each, since several could make a game too hard to win; a
 * switch on New game allows them too (Trevor, 2026-10-24). No published source.
 */
export const DUPLICATE_CHARACTERS: SpecialRule = {
	kind: 'special-rule',
	format: SPECIAL_RULE_FORMAT,
	id: 'duplicate-characters',
	name: 'Duplicate Characters',
	// Trevor's own wording (2026-10-24).
	about: 'There can be multiple copies of characters in the bag.',
	sources: [],
	parts: {
		duplicates: {
			kind: 'allowed',
			extrasMayBeDrunk: false,
			notTypes: ['demon'],
			// Our own wording, hidden until Trevor approves it (approved-about.ts).
			instructions: 'You may put more than one copy of any character but a Demon in the bag.'
		}
	}
};
