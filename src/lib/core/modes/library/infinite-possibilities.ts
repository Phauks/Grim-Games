import { GAME_MODE_FORMAT, type GameMode } from '../types.ts';

const POST = 'https://chillclocktower.com/2024/04/28/a-script-of-infinite-possibilities/';

/**
 * A Script of Infinite Possibilities (Patters): Trouble Brewing plus the Banshee, with "+1"
 * tokens standing for extra characters from off the script, picked at random or by an
 * audience; only their players know them. One extra good and one extra evil is common; the
 * Storyteller may share a range of how many. Off-script registration is the Storyteller's
 * call, and a Summoner shouldn't be offered extra Demons unless announced. Trevor called it
 * "Script of Infinite Impossibilities" (2026-10-17). Source: POST below.
 */
export const INFINITE_POSSIBILITIES: GameMode = {
	format: GAME_MODE_FORMAT,
	id: 'infinite-possibilities',
	name: 'A Script of Infinite Possibilities',
	about:
		'Trouble Brewing plus the Banshee, with hidden extra characters from off the script that only their players know about. The Storyteller may tell the table a range of how many.',
	aliases: ['Trouble Bucket', 'Infinite Impossibilities'],
	sources: [{ title: 'A Script of Infinite Possibilities (Chill on the Clocktower)', url: POST }],
	credits: ['Patters'],
	parts: {
		pool: {
			kind: 'script-plus-hidden',
			extras: { townsfolk: 1, minion: 1 },
			announceRange: true
		},
		forced: { inPlay: [], onScript: ['banshee'] },
		restricted: { banned: [], onlyFor: [] },
		ruleChanges: [{ characters: ['summoner'] }],
		information: [{ characters: [] }]
	}
};
