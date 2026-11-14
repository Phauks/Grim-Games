import { COUNT, obj, oneOf, variants } from '../field-spec.ts';
import { specPart, partWords } from './part.ts';

/**
 * Who may nominate, one of:
 * - `by: 'storyteller'`: while its ability works, no player nominates, only the Storyteller,
 *   for the whole table (the Bishop, https://wiki.bloodontheclocktower.com/Bishop);
 * - `perGame`: its own player may nominate only this many times in the game (the Golem,
 *   https://wiki.bloodontheclocktower.com/Golem).
 * A nomination that breaks it is recorded with a warning (warn, never lock).
 */
export const nominating = partWords(
	specPart(
		'day',
		'Who may nominate',
		'Only the Storyteller nominates, or its player may nominate only so many times a game.',
		variants(
			{ label: 'Only the Storyteller', has: 'by', spec: obj({ by: oneOf(['storyteller']) }) },
			{ label: 'Times a game', has: 'perGame', spec: obj({ perGame: COUNT }) }
		)
	),
	{
		'<Only the Storyteller>.by': {
			label: 'Nominates',
			names: {
				storyteller: 'Only the Storyteller'
			}
		},
		'<Times a game>.perGame': {
			label: 'Times a game'
		}
	}
);
