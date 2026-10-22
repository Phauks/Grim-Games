import { SPECIAL_RULE_FORMAT, type SpecialRule } from '../types.ts';

const PAGE = 'https://beardytas.com/garden-of-djinn/council-of-the-dead/';

/**
 * Council of the Dead's rule (Script World Cup 2025): at the start of night 4 the dead wake
 * together for 2 minutes, then secretly vote for a living player, who gets a boon. Trevor
 * (2026-10-22) asked for it on any script. Night 4's order gets a step for it, after Dusk
 * (night-steps.ts). The page names no author. Source: PAGE.
 */
export const COUNCIL_OF_THE_DEAD: SpecialRule = {
	kind: 'special-rule',
	format: SPECIAL_RULE_FORMAT,
	id: 'council-of-the-dead',
	name: 'Council of the Dead',
	// Our own wording, approved 2026-10-22 with its instructions (approved-about.ts).
	about:
		'On night 4 the dead wake together for 2 minutes, then secretly vote for a living player, who receives a boon.',
	sources: [{ title: 'Council of the Dead (Beardy on the Clocktower)', url: PAGE }],
	parts: {
		// The author's rule, quoted, with "n4" written as Night 4 (Trevor, 2026-10-22).
		text: [
			'At the start of Night 4, dead wake together for 2 min, then secretly vote on a living player (if there’s no majority, the ST chooses). The chosen player gets a boon.'
		],
		nightSteps: [
			{
				kind: 'wake',
				when: 'one-night',
				night: 4,
				dead: true,
				minutes: 2,
				instructions:
					'At the start of night 4, wake the dead together for 2 minutes. Then each secretly votes for a living player. If no player has a majority, you choose. Give the chosen player a helpful effect of your choice.'
			}
		]
	}
};
