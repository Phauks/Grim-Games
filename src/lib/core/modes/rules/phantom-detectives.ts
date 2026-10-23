import { SPECIAL_RULE_FORMAT, type SpecialRule } from '../types.ts';

const PAGE = 'https://schnauzerclub.neocities.org/scripts/thephantomdetectives';

/**
 * The Phantom Detectives' rule (Script World Cup 2025): dead players keep their abilities,
 * except Demons, and Townsfolk have none from the start of night 1 until they die. Trevor
 * (2026-10-22) asked for it on any script. Run Night Order wakes whoever has an ability under
 * it (`hasAbilityUnder`). Source: PAGE, which names no author for the rule.
 */
export const PHANTOM_DETECTIVES: SpecialRule = {
	kind: 'special-rule',
	format: SPECIAL_RULE_FORMAT,
	id: 'phantom-detectives',
	name: 'The Phantom Detectives',
	aliases: ['Phantom Detectives'],
	// Our own wording, approved 2026-10-22 with its instructions (approved-about.ts).
	about:
		'Townsfolk have no ability while alive and gain it when they die. Every other dead player keeps their ability, except the Demon.',
	sources: [{ title: 'The Phantom Detectives (Schnauzer Club)', url: PAGE }],
	parts: {
		// The author's rule, quoted.
		text: [
			'Dead players (not Demons) keep their abilities.',
			'Each Townsfolk loses their ability at the start of night 1, then regains it on death.'
		],
		abilities: {
			kind: 'dead-keep',
			deadLose: ['demon'],
			livingLose: ['townsfolk'],
			instructions:
				'Living Townsfolk don’t wake and have no ability; setup effects still happen. A Townsfolk who dies gains its ability and wakes at its usual place. Other dead players keep waking, except a dead Demon.'
		}
	}
};
