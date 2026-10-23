import { SPECIAL_RULE_FORMAT, type SpecialRule } from '../types.ts';

const PAGE = 'https://beardytas.com/garden-of-djinn/the-djinns-bargain/';

/**
 * The Djinn's Bargain's rule (Script World Cup 2025, carried there as a homebrew Fabled): a
 * player may die as they nominate, and their nominee's ability then works twice until dusk the
 * next day. The page adds that no one may do so while only 3 players live, and that the
 * Storyteller never asks the player; the board's prompt asks the Storyteller, once the player
 * has said so. The 3-player limit is a switch on New game (rule-switches.ts, Trevor
 * 2026-10-23), off by default as the rule text leaves it out. The page names no author.
 * Source: PAGE.
 */
export const DJINNS_BARGAIN: SpecialRule = {
	kind: 'special-rule',
	format: SPECIAL_RULE_FORMAT,
	id: 'djinns-bargain',
	name: 'The Djinn’s Bargain',
	// Our own wording, approved by Trevor 2026-10-23 (approved-about.ts).
	about:
		'A player who nominates may choose to die. If they do, the player they nominated has their ability work twice until dusk the next day.',
	sources: [{ title: 'The Djinn’s Bargain (Beardy on the Clocktower)', url: PAGE }],
	parts: {
		// The author's rule, quoted.
		text: [
			'Nominators may choose to die after making a nomination.',
			'If they do, their nominee’s ability works twice until dusk tomorrow.'
		],
		// The board asks whether the nominator chose to die when a nomination is recorded.
		nominations: [{ kind: 'nominator-may-die' }],
		ruleChanges: [
			{
				instructions:
					'A player may say, as they nominate, that they choose to die. Don’t ask them; once the nomination is made, the chance has passed. If they do, they die at once, and you announce it. Until dusk the next day, the nominee’s ability works twice: each time it takes effect, resolve it twice, one choice at a time. A once per game ability that was already used stays used.'
			}
		]
	}
};
