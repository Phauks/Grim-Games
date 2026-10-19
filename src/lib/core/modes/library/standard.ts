import { GAME_MODE_FORMAT, type GameMode } from '../types.ts';

const TPI = 'https://bloodontheclocktower.com/';

/**
 * A standard game: no part changed (https://wiki.bloodontheclocktower.com/Setup). The game
 * is The Pandemonium Institute's (Trevor, 2026-10-18: Standard's About credits TPI and its
 * sources). Its description is Trevor's own wording (2026-10-19).
 */
export const STANDARD: GameMode = {
	format: GAME_MODE_FORMAT,
	id: 'standard',
	name: 'Standard',
	about: 'Normal rules for Blood on the Clocktower',
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
