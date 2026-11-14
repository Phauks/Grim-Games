import { anyOf, obj } from '../field-spec.ts';
import { SEATED_TYPES } from '../types.ts';
import { specPart, type PartValue, partWords } from './part.ts';

/**
 * Who has an ability while a rule source with this part is in play: dead players keep theirs,
 * except those of a `deadLose` type, and living players of a `livingLose` type have none until
 * they die (The Phantom Detectives,
 * https://schnauzerclub.neocities.org/scripts/thephantomdetectives; `rules/rule-sources.ts`).
 */
export const deadKeepAbilities = partWords(
	specPart(
		'deaths',
		'Dead keep abilities',
		'While in play, dead players keep their abilities, except some types, and living players of some types have none until they die.',
		obj({ deadLose: anyOf(SEATED_TYPES), livingLose: anyOf(SEATED_TYPES) })
	),
	{
		deadLose: {
			label: 'Dead of these types lose theirs'
		},
		livingLose: {
			label: 'Living of these types have none'
		}
	}
);

export type DeadKeepAbilities = PartValue<typeof deadKeepAbilities>;
