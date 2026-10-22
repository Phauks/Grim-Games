import { SPECIAL_RULE_FORMAT, type SpecialRule } from '../types.ts';

/**
 * +1 (Trevor's own rule, 2026-10-18; asked again 2026-10-22): any script, plus exactly one
 * character from off the script in play, with the table told that one is. A sibling of A
 * Script of Infinite Possibilities with a single announced extra, so the two set the same
 * part and choosing both warns (combineRules). No published source.
 */
export const PLUS_ONE: SpecialRule = {
	kind: 'special-rule',
	format: SPECIAL_RULE_FORMAT,
	id: 'plus-one',
	name: '+1',
	// Our own draft (2026-10-22): shows once Trevor approves it (approved-about.ts).
	about:
		'Any script, plus one character from off the script in play. The table is told that one extra character is in play.',
	aliases: ['Plus One'],
	sources: [],
	parts: {
		pool: {
			kind: 'script-plus-hidden',
			// One row per type; exactly one of them is filled (count).
			extras: { townsfolk: 1, outsider: 1, minion: 1, demon: 1 },
			announceRange: false,
			count: { min: 1, max: 1 }
		},
		information: [
			{
				characters: [],
				instructions: 'Tell the table that one character from off the script is in play.'
			}
		]
	}
};
