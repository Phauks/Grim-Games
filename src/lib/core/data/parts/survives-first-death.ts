import { obj, TOKEN } from '../field-spec.ts';
import { specPart } from './part.ts';

/**
 * Its player's first death does not happen; placing `spentToken`, one of its reminders,
 * marks the ability used (the Fool's "No Ability").
 */
export const survivesFirstDeath = specPart(
	'deaths',
	'Survives the first death',
	'Its player’s first death does not happen.',
	obj({ spentToken: TOKEN })
);
