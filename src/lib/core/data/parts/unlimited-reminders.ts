import { truePart } from './part.ts';

/**
 * Its reminder tokens never run out (Trevor, 2026-11-12: the Bootlegger's "should be
 * considered infinite"): the bank keeps one of each in its ∞ stretch however many are placed,
 * and no copy on the board counts as an extra (`features/board/reminders.ts`).
 */
export const unlimitedReminders = truePart(
	'tokens',
	'Unlimited reminders',
	'Its reminder tokens never run out: each stays in the ∞ part of the reminder bank however many are placed.'
);
