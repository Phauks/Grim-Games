import { SPECIAL_RULE_FORMAT, type SpecialRule } from '../types.ts';

const PAGE = 'https://beardytas.com/garden-of-djinn/the-ballad-of-seat-7/';

/**
 * The Ballad of Seat 7's rule (Script World Cup 2025): one seat is dealt a character as usual,
 * but no one plays it, and once a game the Storyteller may speak for it. Trevor (2026-10-18)
 * wants it playable on any script. The page names no author. Its optional rules (Seats Rise
 * Up and three more) are left to the page. Source: PAGE.
 */
export const SEAT_7: SpecialRule = {
	kind: 'special-rule',
	format: SPECIAL_RULE_FORMAT,
	id: 'seat-7',
	name: 'The Ballad of Seat 7',
	// Our own draft (2026-10-19): shows once Trevor approves it (approved-about.ts).
	about:
		'One seat is dealt a character as usual, but no one plays it. Its choices are arbitrary, and once per game the Storyteller may speak for it.',
	aliases: ['Seat 7'],
	sources: [{ title: 'The Ballad of Seat 7 (Beardy on the Clocktower)', url: PAGE }],
	parts: {
		// The author's rule, quoted.
		text: [
			'Seat 7 remains empty. Its choices are arbitrary. Once per game the storyteller may speak on its behalf.'
		],
		seats: {
			kind: 'storyteller-seat',
			count: 1,
			speaks: 'once-per-game',
			instructions:
				'One seat is dealt a character as usual, but no one plays it. Make its choices arbitrarily. Once per game you may speak for it.'
		}
	}
};
