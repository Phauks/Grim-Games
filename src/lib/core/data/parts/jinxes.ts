import { readJinxRules } from '../jinx-rules.ts';
import { objectPart } from './part.ts';

/** What each jinx with another character changes, keyed by that character (`jinx-rules.ts`). */
export const jinxes = objectPart(
	'Jinxes',
	'What each jinx with another character changes, while both are on the script.',
	(raw, path, issues) => readJinxRules(raw, path, issues)
);
