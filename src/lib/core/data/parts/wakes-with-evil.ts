import { truePart } from './part.ts';

/**
 * Its player wakes whenever other evil players wake: the night order notes it on each Minion
 * and Demon step (`night-order.ts`; the Wraith, https://wiki.bloodontheclocktower.com/Wraith).
 */
export const wakesWithEvil = truePart(
	'Wakes with evil',
	'Its player wakes whenever other evil players wake.'
);
