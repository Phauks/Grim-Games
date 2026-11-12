import { countPart } from './part.ts';

/** At most this many guesses a day, for a `guesses` claim (the Juggler's 5). */
export const guessLimit = countPart(
	'day',
	'Guess limit',
	'At most this many guesses a day, for a guesses claim.'
);
