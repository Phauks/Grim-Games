import { SPECIAL_RULE_FORMAT, type SpecialRule } from '../types.ts';

const POST = 'https://chillclocktower.com/2024/04/28/a-script-of-infinite-possibilities/';

/**
 * A Script of Infinite Possibilities (by Nashable, from an idea Patters popularised): the post
 * plays Trouble Brewing plus the Banshee, with "+1"
 * tokens standing for extra characters from off the script, picked at random or by an
 * audience; only their players know them. One extra good and one extra evil is common; the
 * Storyteller may share a range of how many. Off-script registration is the Storyteller's
 * call, and a Summoner shouldn't be offered extra Demons unless announced. Trevor called it
 * "Script of Infinite Impossibilities" (2026-10-17), and on 2026-10-18 made it any script
 * with 1 to 4 hidden extras ("update game mode to match my description"). A special rule
 * since 2026-10-18 (Trevor: rules stack on a game mode); a mode that replaces the script's
 * pool can't take it (combineRules warns). Source: POST.
 */
export const INFINITE_POSSIBILITIES: SpecialRule = {
	kind: 'special-rule',
	format: SPECIAL_RULE_FORMAT,
	id: 'infinite-possibilities',
	name: 'A Script of Infinite Possibilities',
	about:
		'Any script, with 1-4 hidden extra characters from off the script that only their players know about. The Storyteller may tell the table a range of how many custom characters are in play.',
	aliases: ['Trouble Bucket', 'Infinite Impossibilities'],
	sources: [{ title: 'A Script of Infinite Possibilities (Chill on the Clocktower)', url: POST }],
	// The post's byline; it credits Patters with the idea, not the script.
	authors: [{ title: 'Nashable', url: POST }],
	parts: {
		pool: {
			kind: 'script-plus-hidden',
			// Rows the Storyteller fills; 1 to 4 of them in all (Trevor, 2026-10-18), one of each
			// type (Trevor, 2026-10-19: "only 1 townsfolk custom and add 1 demon custom").
			extras: { townsfolk: 1, outsider: 1, minion: 1, demon: 1 },
			// The Storyteller may tell the table how many (the extras page offers a range).
			announceRange: true,
			count: { min: 1, max: 4 }
		},
		ruleChanges: [
			{
				characters: ['summoner'],
				instructions:
					'You decide whether a character may register as one from off the script. Don’t offer a Summoner extra Demons from off the script unless you announced them.'
			}
		]
	}
};
