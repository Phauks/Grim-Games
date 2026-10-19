import { GAME_MODE_FORMAT, type GameMode } from '../types.ts';

/**
 * Sushi Buffet: each player in turn is offered a few characters and keeps one; refusing an offer brings a smaller one (Grimbits' draft tool,
 * https://grimbits.com/draft-buffet/). The tool's options are the defaults here: offers of
 * 3 → 2 → 1, unchosen characters discarded, offers may mix types. The draft keeps the setup
 * sheet's counts for the player count: no drafted character changes them (Trevor,
 * 2026-10-19, "There is no automatic changes of the count of players"). Played example with
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
		'Each Player can select from three drafted characters, players can select their character, or mulligan into a new set of two drafted characters, where they once again can select their character, or mulligan into the final character. The demon gets no bluffs.',
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
		bluffs: { kind: 'none', instructions: 'The Demon receives no bluffs.' },
		pool: { kind: 'all-characters' },
		setupModifiers: {
			kind: 'only',
			characters: [],
			instructions:
				'Drafted characters never change the counts: the draft keeps the setup sheet’s counts for the player count, so a Baron adds no Outsiders.'
		},
		assignment: {
			kind: 'draft',
			offers: [3, 2, 1],
			recycleUnchosen: false,
			oneTypePerOffer: false,
			instructions:
				'Each player is offered 3 characters, of any types, and keeps one, or refuses them for 2 new ones, then for a last one. Characters not selected may be recycled; that is the Storyteller’s choice.'
		}
	}
};
