import { SPECIAL_RULE_FORMAT, type SpecialRule } from '../types.ts';

const PAGE = 'https://beardytas.com/garden-of-djinn/binary-supernovae/';

/**
 * Binary Supernovae's rule (Script World Cup 2025): one more Demon, and good wins as soon as
 * a Demon dies by execution. Trevor (2026-10-22) asked for it on any script. Its line goes on
 * the game's Bootlegger (features/modes/start.ts), whose "[+1 Demon]" adds the Demon at setup
 * like any bracket, so a Summoner's [No Demon] leaves 1. The game end prompt checks the
 * execution, which a living Mastermind may hold off as the page allows. The page names no
 * author. Source: PAGE.
 */
export const BINARY_SUPERNOVAE: SpecialRule = {
	kind: 'special-rule',
	format: SPECIAL_RULE_FORMAT,
	id: 'binary-supernovae',
	name: 'Binary Supernovae',
	// Our own wording, approved 2026-10-22 with its instructions (approved-about.ts).
	about:
		'One extra Demon is in play. Good wins as soon as any Demon dies by execution; a Demon killed any other way doesn’t end the game.',
	sources: [{ title: 'Binary Supernovae (Beardy on the Clocktower)', url: PAGE }],
	parts: {
		// The author's rule, quoted.
		text: ['If a Demon dies by execution, good wins. Summoner only removes 1 Demon. [+1 Demon]'],
		winConditions: {
			kind: 'demon-executed',
			instructions:
				'Good wins as soon as any Demon dies by execution, unless an ability such as the Mastermind’s keeps the game going. A Demon killed by an ability doesn’t end it.'
		},
		ruleChanges: [
			{
				characters: ['summoner'],
				instructions:
					'The Summoner removes only 1 Demon at setup, so 1 Demon starts in play. Before the game, say whether the Summoner may make a second copy of that Demon.'
			}
		]
	}
};
