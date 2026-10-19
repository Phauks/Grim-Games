import { SPECIAL_RULE_FORMAT, type SpecialRule } from '../types.ts';

const PAGE = 'https://beardytas.com/garden-of-djinn/stowed-away/';

/**
 * Stowed Away's rule (Script World Cup 2025): up to two Travellers go in the bag, the other
 * counts are for that many fewer players, and no one is told who the Travellers are. Trevor
 * (2026-10-18) wants it playable on any script. The page names no author. Source: PAGE.
 */
export const STOWED_AWAY: SpecialRule = {
	kind: 'special-rule',
	format: SPECIAL_RULE_FORMAT,
	id: 'stowed-away',
	name: 'Stowed Away',
	// Our own draft (2026-10-19): shows once Trevor approves it (approved-about.ts).
	about:
		'Up to 2 Travellers may be in the bag, with the other counts set for that many fewer players. No one is told who the Travellers are, and exiling one counts as an execution.',
	sources: [{ title: 'Stowed Away (Beardy on the Clocktower)', url: PAGE }],
	parts: {
		// The author's rule, quoted.
		text: [
			'Up to 2 recommended travellers might be in the bag & the player count lowers accordingly.',
			'Travellers are not announced, executions & exiles are equivalent.'
		],
		travellers: {
			inBag: 2,
			announced: false,
			instructions:
				'Put up to 2 Travellers in the bag, and set the player count for that many fewer players. Don’t announce who the Travellers are. Exiling a Traveller counts as an execution.'
		}
	}
};
