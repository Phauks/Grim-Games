import { ownWords, STR } from '../field-spec.ts';
import { specPart } from './part.ts';

/**
 * Our own short wording of the character's optional rule (`optionalRule`), shown beside its
 * switch at the start of a game in place of the wiki's line (Trevor, 2026-11-06: the wiki's
 * lines read as casual). Each official one is text Trevor approved; without it the wiki's own
 * line shows.
 */
export const optionalRuleText = specPart(
	'setup',
	'Optional rule text',
	'Our own short wording of the optional rule, shown beside its switch.',
	ownWords(STR)
);
