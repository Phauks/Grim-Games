import { obj, oneOf, opt, T, TOKEN } from '../field-spec.ts';
import { specPart, partWords } from './part.ts';

/**
 * The ability is set off by its player's death, by `by`: the Demon's kill, another ability's,
 * or either (the Ravenkeeper, the Sage); with `night`, only a death at night, never an
 * execution (the Ravenkeeper's "if you die at night"). With `places`, one of its reminders, the
 * death is when that reminder goes on its player (the Barber's "Haircuts Tonight"): the board
 * asks to place it once the player is marked dead. With `placesOn: chosen` as well, it goes on
 * a player the Storyteller picks instead (the Sweetheart's Drunk, "you choose any one player
 * to become drunk").
 */
export const onDeath = partWords(
	specPart(
		'deaths',
		'On death',
		'The ability is set off by its player’s death.',
		obj({
			by: oneOf(['demon', 'other', 'any']),
			night: opt(T),
			places: opt(TOKEN),
			placesOn: opt(oneOf(['chosen']))
		}),
		(value, path, issues) => {
			if (!value.placesOn || value.places) return value;
			issues.add(`${path}.placesOn`, 'only with "places"');
			return undefined;
		}
	),
	{
		by: {
			label: 'Set off by',
			names: {
				demon: 'The Demon’s kill',
				other: 'Another ability’s kill',
				any: 'Any kill'
			}
		},
		night: {
			label: 'Only a death at night'
		},
		places: {
			label: 'Places',
			about: 'Asks to place this reminder once its player dies.'
		},
		placesOn: {
			label: 'On',
			names: {
				chosen: 'A player the Storyteller picks'
			}
		}
	}
);
