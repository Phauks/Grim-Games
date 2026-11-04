import type { JinxRules } from '../jinx-rules.ts';
import { readJinxRules } from '../jinx-read.ts';
import type { CharacterId } from '../types.ts';
import type { Part } from './part.ts';

/**
 * What each jinx with another character changes, keyed by that character (`jinx-rules.ts`). The
 * whole rules block is passed on, so an effect whose prerequisite is missing is reported.
 */
export const jinxes: Part<Readonly<Record<CharacterId, JinxRules>>> = {
	label: 'Jinxes',
	description: 'What each jinx with another character changes, while both are on the script.',
	read: (block, key, path, issues) => readJinxRules(block[key], `${path}.${key}`, issues, block)
};
