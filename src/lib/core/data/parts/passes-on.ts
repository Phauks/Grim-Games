import { oneOf, optObj, T } from '../field-spec.ts';
import { ALIGNMENTS } from '../types.ts';
import { specPart, partWords } from './part.ts';

/**
 * When its ability is set off by its player's death (`onDeath`), another player becomes this
 * character: only `alive` players, and only those of `alignment` when given (the Farmer's
 * alive good player, https://wiki.bloodontheclocktower.com/Farmer). Read by
 * `rules/abilities/becomes.ts` (`passOnSeats`).
 */
export const passesOn = partWords(
	specPart(
		'deaths',
		'Passes on',
		'When its player dies, another player becomes this character.',
		optObj({ alive: T, alignment: oneOf(ALIGNMENTS) })
	),
	{
		alive: {
			label: 'Only living players'
		},
		alignment: {
			label: 'Only players of'
		}
	}
);
