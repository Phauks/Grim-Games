import { SPECIAL_RULE_FORMAT } from './types.ts';
import { GAME_MODE_REVISION } from './guide-fields.ts';

/** The least a special rule needs: one line of text. */
export const RULE_MINIMAL_EXAMPLE = {
	format: SPECIAL_RULE_FORMAT,
	revision: GAME_MODE_REVISION,
	id: 'house-rule',
	name: 'House rule',
	sources: [{ title: 'Our group’s house rules', url: 'https://example.com/house-rules' }],
	setup: { text: ['Our house rule.'] }
};
