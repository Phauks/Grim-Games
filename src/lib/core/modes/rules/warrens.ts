import { SPECIAL_RULE_FORMAT, type SpecialRule } from '../types.ts';

const PAGE = 'https://beardytas.com/garden-of-djinn/the-warrens/';

/**
 * The Warrens' rule (Script World Cup 2025): while 5 or more players live, an evil player who
 * nominates another living evil player swaps characters with them on the spot. Travellers are
 * left out. When a nomination is recorded the board offers the swap (`nominations`); they learn
 * their new characters that night, as the page says. The page names no author. Source: PAGE.
 */
export const WARRENS: SpecialRule = {
	kind: 'special-rule',
	format: SPECIAL_RULE_FORMAT,
	id: 'warrens',
	name: 'The Warrens',
	// Our own wording, approved by Trevor 2026-10-23 (approved-about.ts).
	about:
		'While 5 or more players are alive, an evil player who nominates another living evil player swaps characters with them at once. Travellers are left out.',
	sources: [{ title: 'The Warrens (Beardy on the Clocktower)', url: PAGE }],
	parts: {
		// The author's rule, quoted (its "charactes" spelt out).
		text: [
			'If 5 or more players live, evil players who nominate other living evil players (not Travellers) immediately swap characters'
		],
		nominations: [{ kind: 'evil-swap', minAlive: 5 }],
		ruleChanges: [
			{
				instructions:
					'While 5 or more players are alive, when an evil player nominates another living evil player, and neither is a Traveller, swap their character tokens straight away. Each learns their new character when they next wake at night.'
			}
		]
	}
};
