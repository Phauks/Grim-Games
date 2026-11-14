/**
 * The parts that began as a special rule's own, part by part (format-guide.ts). Since
 * 2026-11-01 any file may set them, a game mode too (Trevor: one format for both).
 */
import { RULE_ONLY_SECTIONS } from './types.ts';
import { guideSection } from './setup-guide.ts';
import { type GuideSection } from './guide-fields.ts';
import { GUIDE_SECTIONS } from './mode-guide.ts';

export const RULE_GUIDE_SECTIONS: GuideSection[] = RULE_ONLY_SECTIONS.map(guideSection);

/** Every part any file can set, in the guide's order. */
export const FILE_GUIDE_SECTIONS: GuideSection[] = [...GUIDE_SECTIONS, ...RULE_GUIDE_SECTIONS];
