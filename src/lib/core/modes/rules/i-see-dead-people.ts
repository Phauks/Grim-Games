import { SPECIAL_RULE_FORMAT, type SpecialRule } from '../types.ts';

const PAGE = 'https://beardytas.com/garden-of-djinn/i-see-dead-people/';

/**
 * I See Dead People's rule (Script World Cup 2025, carried there as a homebrew Fabled): the
 * Storyteller doesn't announce deaths. Its other two lines are run by the Storyteller.
 * Trevor (2026-10-18) wants it playable on any script. The page names no author. Source: PAGE.
 */
export const I_SEE_DEAD_PEOPLE: SpecialRule = {
	kind: 'special-rule',
	format: SPECIAL_RULE_FORMAT,
	id: 'i-see-dead-people',
	name: 'I See Dead People',
	// Our own draft (2026-10-19): shows once Trevor approves it (approved-about.ts).
	about:
		'Characters die as normal, but the Storyteller doesn’t announce deaths. Dead players can still nominate, and poisoned players don’t wake.',
	sources: [{ title: 'I See Dead People (Beardy on the Clocktower)', url: PAGE }],
	parts: {
		// The author's rule, quoted.
		text: [
			"Characters die as normal but the storyteller doesn't announce deaths.",
			"Dead players can nominate. Poisoned players don't wake up."
		],
		deaths: {
			kind: 'private',
			instructions:
				'Don’t announce who has died. Dead players can still nominate. Poisoned players don’t wake at night.'
		}
	}
};
