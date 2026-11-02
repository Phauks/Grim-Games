/**
 * The parts that began as a special rule's own, part by part (format-guide.ts). Since
 * 2026-11-01 any file may set them, a game mode too (Trevor: one format for both).
 */
import { SPECIAL_RULE_FORMAT } from './types.ts';
import {
	GAME_MODE_REVISION,
	IDS,
	SEATED,
	type GuideField,
	type GuidePart
} from './guide-fields.ts';
import { GUIDE_PARTS } from './mode-guide.ts';

const COUNT_OP: GuideField[] = [
	{
		name: 'type',
		type: 'text',
		required: true,
		about: 'The character type it changes.',
		values: SEATED
	},
	{
		name: 'values',
		type: 'list of whole numbers',
		required: true,
		about: 'The change, or the choices of change: [1] is +1, [0, 1] is +0 or +1.'
	}
];

export const RULE_GUIDE_PARTS: GuidePart[] = [
	{
		part: 'text',
		list: true,
		about:
			'The rule’s own lines, shown on the Bootlegger. A script’s Bootlegger lines become a rule with only this part.',
		fields: [],
		kinds: []
	},
	{
		part: 'countChanges',
		list: true,
		about:
			'Changes to how many of each character type, added to any others (a script’s [+1 Demon]).',
		fields: [],
		kinds: [
			{ kind: 'delta', about: 'Add one of the values.', fields: COUNT_OP },
			{
				kind: 'set',
				about: 'The count becomes one of the values.',
				fields: COUNT_OP
			},
			{
				kind: 'any',
				about: 'The Storyteller picks the count.',
				fields: COUNT_OP.slice(0, 1)
			}
		]
	},
	{
		part: 'travellers',
		list: false,
		about: 'Travellers dealt from the bag like other characters.',
		fields: [
			{
				name: 'inBag',
				type: 'whole number',
				required: true,
				about:
					'At most this many Travellers in the bag. The other counts are for that many fewer players.'
			},
			{
				name: 'announced',
				type: 'true or false',
				required: true,
				about: 'Whether the table is told who the Travellers are.'
			}
		],
		kinds: []
	},
	{
		part: 'seats',
		list: false,
		about: 'Seats dealt a character that no one plays.',
		fields: [],
		kinds: [
			{
				kind: 'storyteller-seat',
				about: 'The Storyteller holds the seat.',
				fields: [
					{ name: 'count', type: 'whole number', required: true, about: 'How many such seats.' },
					{
						name: 'speaks',
						type: 'text',
						required: true,
						about: 'Whether the Storyteller may speak for the seat.',
						values: ['never', 'once-per-game']
					}
				]
			}
		]
	},
	{
		part: 'deaths',
		list: false,
		about: 'How deaths are announced.',
		fields: [],
		kinds: [
			{
				kind: 'private',
				about: 'The Storyteller doesn’t announce deaths; the players’ view doesn’t show them.',
				fields: []
			}
		]
	},
	{
		part: 'nightSteps',
		list: true,
		about: 'Steps added to each night.',
		fields: [],
		kinds: [
			{
				kind: 'wake',
				about: 'These characters or types wake.',
				fields: [
					{
						name: 'when',
						type: 'text',
						required: true,
						about: 'Which nights.',
						values: ['each-night', 'each-night-except-first', 'one-night']
					},
					{
						name: 'night',
						type: 'whole number',
						required: false,
						about: 'For one-night: which night (1 is the first night).'
					},
					{ name: 'characters', type: IDS, required: false, about: 'Who wakes.' },
					{
						name: 'types',
						type: 'list of character types',
						required: false,
						about: 'Every character of these types wakes.',
						values: SEATED
					},
					{
						name: 'dead',
						type: 'true or false',
						required: false,
						about: 'Every dead player wakes, together. The app adds this step to that night.'
					},
					{
						name: 'minutes',
						type: 'whole number',
						required: false,
						about: 'How long they wake for.'
					}
				]
			}
		]
	},
	{
		part: 'abilities',
		list: false,
		about: 'Who has an ability, alive or dead.',
		fields: [],
		kinds: [
			{
				kind: 'dead-keep',
				about:
					'Dead players keep their abilities. Run Night Order wakes whoever has one under the rule.',
				fields: [
					{
						name: 'deadLose',
						type: 'list of character types',
						required: true,
						about: 'Dead players of these types lose their abilities as usual.',
						values: SEATED
					},
					{
						name: 'livingLose',
						type: 'list of character types',
						required: true,
						about: 'Living players of these types have no ability until they die.',
						values: SEATED
					}
				]
			}
		]
	},
	{
		part: 'demonAttacks',
		list: false,
		about: 'Who the Demon attacks each night.',
		fields: [],
		kinds: [
			{
				kind: 'script-order',
				about:
					'The next living in-play character in script order, after the last one the Demon killed. The walk-through names it on the Demon’s step.',
				fields: []
			}
		]
	},
	{
		part: 'nominations',
		list: true,
		about:
			'What a nomination sets off. When a nomination is recorded, the board offers it to the Storyteller.',
		fields: [
			{
				name: 'minAlive',
				type: 'whole number',
				required: false,
				about: 'Only while at least this many players are alive.'
			}
		],
		kinds: [
			{
				kind: 'evil-swap',
				about:
					'An evil player who nominates a living evil player swaps characters with them. Travellers are left out.',
				fields: []
			},
			{
				kind: 'nominator-may-die',
				about:
					'The nominator may choose to die; the nominee’s ability then works twice until the next dusk.',
				fields: []
			}
		]
	}
];

/** Every part any file can set, in the guide's order. */
export const FILE_GUIDE_PARTS: GuidePart[] = [...GUIDE_PARTS, ...RULE_GUIDE_PARTS];

/** The least a special rule needs: one line of text. */
export const RULE_MINIMAL_EXAMPLE = {
	format: SPECIAL_RULE_FORMAT,
	revision: GAME_MODE_REVISION,
	id: 'house-rule',
	name: 'House rule',
	sources: [{ title: 'Our group’s house rules', url: 'https://example.com/house-rules' }],
	parts: { text: ['Our house rule.'] }
};
