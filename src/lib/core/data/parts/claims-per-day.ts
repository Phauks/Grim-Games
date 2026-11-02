import { countPart } from './part.ts';

/**
 * At most this many of its `dayClaim` logged a day (the Alsaahir guesses once each day,
 * https://wiki.bloodontheclocktower.com/Alsaahir): for a `guesses` claim, its notes that hold
 * guesses; otherwise all its notes. One more warns, never locks.
 */
export const claimsPerDay = countPart(
	'Claims a day',
	'At most this many of its day claims logged each day.'
);
