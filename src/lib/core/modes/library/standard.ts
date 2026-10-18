import { GAME_MODE_FORMAT, type GameMode } from '../types.ts';

const TPI = 'https://bloodontheclocktower.com/';

/**
 * A standard game: no part changed (https://wiki.bloodontheclocktower.com/Setup). The game
 * is The Pandemonium Institute's (Trevor, 2026-10-18: Standard's About credits TPI and its
 * sources). Its description shows once Trevor approves it (approved-about.ts).
 */
export const STANDARD: GameMode = {
	format: GAME_MODE_FORMAT,
	id: 'standard',
	name: 'Standard',
	about:
		'Blood on the Clocktower as The Pandemonium Institute publishes it: one script, the setup counts for the number of players, and characters drawn from the bag.',
	sources: [
		{
			title: 'Setup (Blood on the Clocktower wiki)',
			url: 'https://wiki.bloodontheclocktower.com/Setup'
		},
		{ title: 'Blood on the Clocktower', url: TPI }
	],
	authors: [{ title: 'The Pandemonium Institute', url: TPI }],
	parts: {}
};
