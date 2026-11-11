import { anyOf, obj, TOKEN } from '../field-spec.ts';
import { SEATED_TYPES } from '../types.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * Its player's token is swapped for a character whose ability they gain, of `good` types
 * when good and `evil` types when evil, with `token` on them to say who they really are
 * (the Apprentice: a Townsfolk or a Minion, https://wiki.bloodontheclocktower.com/Apprentice).
 * The seat's ⋯ menu offers the swap (`features/grimoire/SeatCharacterFlow.svelte`).
 */
export const swapsForAbility = specPart(
	'Swaps for an ability',
	'Its player’s token is swapped for a character whose ability they gain.',
	obj({ token: TOKEN, good: anyOf(SEATED_TYPES), evil: anyOf(SEATED_TYPES) })
);

export type SwapsForAbility = PartValue<typeof swapsForAbility>;
