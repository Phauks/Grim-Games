import { anyOf, obj, TOKEN } from '../field-spec.ts';
import { SEATED_TYPES } from '../types.ts';
import { specPart, type PartValue, partWords } from './part.ts';

/**
 * Its player's token is swapped for a character whose ability they gain, of `good` types
 * when good and `evil` types when evil, with `token` on them to say who they really are
 * (the Apprentice: a Townsfolk or a Minion, https://wiki.bloodontheclocktower.com/Apprentice).
 * A token dealt that way at setup counts; picked later from Gain ability in the seat's ⋯ menu
 * (`features/grimoire/GainAbilityDialog.svelte`), the ability is recorded as given by their own
 * character and they keep their own token (Trevor, 2026-11-12).
 */
export const swapsForAbility = partWords(
	specPart(
		'abilities',
		'Swaps for an ability',
		'Its player’s token is swapped for a character whose ability they gain.',
		obj({ token: TOKEN, good: anyOf(SEATED_TYPES), evil: anyOf(SEATED_TYPES) })
	),
	{
		token: {
			label: 'Reminder'
		},
		good: {
			label: 'When good, from types'
		},
		evil: {
			label: 'When evil, from types'
		}
	}
);

export type SwapsForAbility = PartValue<typeof swapsForAbility>;
