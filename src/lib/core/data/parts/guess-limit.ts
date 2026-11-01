import { readNumber } from '../validate.ts';
import type { Part } from './part.ts';

/** At most this many guesses a day, for a `guesses` claim (the Juggler's 5). */
export const guessLimit: Part<number> = {
	label: 'Guess limit',
	description: 'At most this many guesses a day, for a guesses claim.',
	read: (block, key, path, issues) => {
		const n = readNumber(block, key, path, issues);
		if (n === undefined) return undefined;
		if (Number.isInteger(n) && n > 0) return n;
		issues.add(`${path}.${key}`, `expected a whole number above 0, got ${n}`);
		return undefined;
	}
};
