import { GAME_MODE_FORMAT, type GameMode } from '../types.ts';

/**
 * Sushi Buffet: each player in turn is offered a few characters and keeps one; refusing an offer brings a smaller one (Grimbits' draft tool,
 * https://grimbits.com/draft-buffet/). The tool's options are the defaults here: offers of
 * 3 → 2 → 1, unchosen characters discarded, offers may mix types. Setup modifiers apply as
 * they are drafted, the Storyteller deciding once a count is set. Played example with
 * Pit-Hag and Philosopher banned:
 * https://ekins.blog/2026/05/02/final-3-con-2026-part-1/. Grimbits is the only Sushi
 * Buffet tool found (searched 2026-10-17; https://beardytas.com/resources/ lists it as the
 * draft tool). The draw is from every official character, less restricted ones (Trevor,
 * 2026-10-18).
 */
export const SUSHI_BUFFET: GameMode = {
	format: GAME_MODE_FORMAT,
	id: 'sushi-buffet',
	name: 'Sushi Buffet',
	about:
		'Players draft their characters in turn instead of drawing them. Each is offered three characters from every official character and keeps one, or refuses for a smaller new offer.',
	aliases: ['Draft Buffet'],
	sources: [
		{ title: 'Sushi Buffet Draft (Grimbits)', url: 'https://grimbits.com/draft-buffet/' },
		{
			title: 'Final 3 Con 2026, Part 1 (Ekin)',
			url: 'https://ekins.blog/2026/05/02/final-3-con-2026-part-1/'
		}
	],
	parts: {
		// Trevor, 2026-10-18, in the project chat.
		bluffs: { kind: 'none', cite: 'https://claude.ai/code/project/chan_01LbwopXmmfZCTHhANoebuJ9' },
		pool: { kind: 'all-characters' },
		restricted: { banned: [] },
		setupModifiers: { kind: 'as-chosen' },
		assignment: { kind: 'draft', offers: [3, 2, 1], recycleUnchosen: false, oneTypePerOffer: false }
	}
};
