import { obj, TOKEN } from '../field-spec.ts';
import { specPart, partWords } from './part.ts';

/**
 * Its player's first death does not happen; placing `spentToken`, one of its reminders,
 * marks the ability used (the Fool's "No Ability").
 */
export const survivesFirstDeath = partWords(
	specPart(
		'deaths',
		'Survives the first death',
		'Its player’s first death does not happen.',
		obj({ spentToken: TOKEN })
	),
	{
		spentToken: {
			label: 'Used up by'
		}
	}
);
