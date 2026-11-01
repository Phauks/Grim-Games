import { readNumber } from '../validate.ts';
import type { Part } from './part.ts';

/**
 * Its player may make this many more nominations each day after the day's first execution,
 * even if they already nominated, and of a player already nominated today (the Butcher,
 * https://wiki.bloodontheclocktower.com/Butcher).
 */
export const nominationsAfterExecution: Part<number> = {
	label: 'Nominations after an execution',
	description: 'More nominations its player may make each day after the first execution.',
	read: (block, key, path, issues) => {
		const n = readNumber(block, key, path, issues);
		if (n === undefined) return undefined;
		if (Number.isInteger(n) && n >= 1) return n;
		issues.add(`${path}.${key}`, 'expected a whole number, 1 or more');
		return undefined;
	}
};
