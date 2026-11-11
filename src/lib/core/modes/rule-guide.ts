/**
 * The parts that began as a special rule's own, part by part (format-guide.ts). Since
 * 2026-11-01 any file may set them, a game mode too (Trevor: one format for both).
 */
import { SPECIAL_RULE_FORMAT } from './types.ts';
import { GAME_MODE_REVISION, type GuideSection } from './guide-fields.ts';
import { GUIDE_SECTIONS } from './mode-guide.ts';

export const RULE_GUIDE_SECTIONS: GuideSection[] = [
	{
		part: 'text',
		list: true,
		about:
			'The rule’s own lines, shown on the Bootlegger. A script’s Bootlegger lines become a rule with only this part.',
		fields: [],
		kinds: []
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
	}
];

/** Every part any file can set, in the guide's order. */
export const FILE_GUIDE_SECTIONS: GuideSection[] = [...GUIDE_SECTIONS, ...RULE_GUIDE_SECTIONS];

/** The least a special rule needs: one line of text. */
export const RULE_MINIMAL_EXAMPLE = {
	format: SPECIAL_RULE_FORMAT,
	revision: GAME_MODE_REVISION,
	id: 'house-rule',
	name: 'House rule',
	sources: [{ title: 'Our group’s house rules', url: 'https://example.com/house-rules' }],
	setup: { text: ['Our house rule.'] }
};
