import { countPart } from './part.ts';

/**
 * While its player is alive, at most this many seat swaps a day (the Matron's three,
 * https://wiki.bloodontheclocktower.com/Matron), counted in the day log (`DayLog.swaps`). One
 * more warns, never locks: the Storyteller may still fix the seating.
 */
export const seatSwapsPerDay = countPart(
	'Seat swaps a day',
	'While its player is alive, at most this many seat swaps each day.'
);
