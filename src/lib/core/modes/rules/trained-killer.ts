import { SPECIAL_RULE_FORMAT, type SpecialRule } from '../types.ts';

const PAGE = 'https://beardytas.com/garden-of-djinn/trained-killer/';

/**
 * Trained Killer's rule (Script World Cup 2025): each night but the first, the Demon attacks
 * the next living in-play character in script order. Trevor (2026-10-22) asked for it on any
 * script. The walk-through names the next target on the Demon's step (`nextScriptOrderTarget`);
 * how many the Demon attacks, and survivors, stay the Storyteller's call, as the page says.
 * The page names no author. Source: PAGE.
 */
export const TRAINED_KILLER: SpecialRule = {
	kind: 'special-rule',
	format: SPECIAL_RULE_FORMAT,
	id: 'trained-killer',
	name: 'Trained Killer',
	// Our own draft (2026-10-22): shows once Trevor approves it (approved-about.ts).
	about:
		'The Demon doesn’t choose who to attack. Each night after the first, it attacks the next living in-play character in script order.',
	sources: [{ title: 'Trained Killer (Beardy on the Clocktower)', url: PAGE }],
	parts: {
		// The author's rule, quoted.
		text: ['Each night*, the Demon attacks the next living in-play character(s) in script order.'],
		demonAttacks: {
			kind: 'script-order',
			instructions:
				'Each night after the first, the Demon attacks the next living in-play character in script order, carrying on from the last one it killed. You decide whether a survivor is attacked again or passed over.'
		}
	}
};
