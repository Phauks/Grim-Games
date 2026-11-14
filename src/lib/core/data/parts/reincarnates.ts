import { COUNT, obj, oneOf, opt } from '../field-spec.ts';
import { SEATED_TYPES } from '../types.ts';
import { specPart, type PartValue, partWords } from './part.ts';

/**
 * The `reincarnates` part of a rules block: the first `first` players to die are at once
 * reborn as Travellers the Storyteller picks, alive, keeping their alignment (the Hindu,
 * https://wiki.bloodontheclocktower.com/Hindu). Read by `rules/abilities/reincarnation.ts`.
 *
 * `demonTo`: a Demon among them may be reborn too, and then a living player of this type
 * becomes that Demon (the Hindu's optional rule: a Minion). Without it, a Demon is not reborn.
 */
export const reincarnates = partWords(
	specPart(
		'deaths',
		'Reborn as Travellers',
		'The first players to die are reborn as Travellers.',
		obj({ first: COUNT, demonTo: opt(oneOf(SEATED_TYPES)) })
	),
	{
		first: {
			label: 'First players to die'
		},
		demonTo: {
			label: 'A reborn Demon passes to',
			about: 'Left empty, a Demon is not reborn.'
		}
	}
);

export type Reincarnates = PartValue<typeof reincarnates>;
