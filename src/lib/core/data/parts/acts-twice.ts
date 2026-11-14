import { obj, TOKEN } from '../field-spec.ts';
import { specPart, type PartValue, partWords } from './part.ts';

/**
 * Its `token` on a player makes that player's ability work twice until dusk (M15c,
 * `rules/abilities/acts-twice.ts`): each of their night steps wakes them a second time, and a day ability
 * may be used once more, even a once-per-game one already spent
 * (https://wiki.bloodontheclocktower.com/Barista).
 */
export const actsTwice = partWords(
	specPart(
		'abilities',
		'Acts twice',
		'Its token on a player makes their ability work twice until dusk.',
		obj({ token: TOKEN })
	),
	{
		token: {
			label: 'Reminder'
		}
	}
);

export type ActsTwice = PartValue<typeof actsTwice>;
