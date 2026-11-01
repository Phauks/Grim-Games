import { readImpairs } from '../impairs-rules.ts';
import { objectPart } from './part.ts';

/** How the ability leaves players drunk, poisoned or with no ability (`rules/ability.ts`). */
export const impairs = objectPart(
	'Drunk, poisoned or no ability',
	'How the ability leaves players drunk, poisoned or with no ability.',
	readImpairs
);
