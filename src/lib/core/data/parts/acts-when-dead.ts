import { booleanPart } from './part.ts';

/**
 * The ability still acts once its player is dead: it triggers on their death ("When you
 * die", "If you died today or tonight") or works "even if dead". Its reminders stay with
 * the living ones in the reminder bank.
 */
export const actsWhenDead = booleanPart(
	'Acts when dead',
	'The ability still acts once its player is dead.'
);
