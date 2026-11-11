/**
 * The parts that began as a special rule's own, part by part (format-guide.ts). Since
 * 2026-11-01 any file may set them, a game mode too (Trevor: one format for both).
 */
import { RULE_ONLY_SECTIONS, SPECIAL_RULE_FORMAT } from './types.ts';
import { guideSection } from './setup-guide.ts';
import { GAME_MODE_REVISION, type GuideSection } from './guide-fields.ts';
import { GUIDE_SECTIONS } from './mode-guide.ts';

export const RULE_GUIDE_SECTIONS: GuideSection[] = RULE_ONLY_SECTIONS.map(guideSection);

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
