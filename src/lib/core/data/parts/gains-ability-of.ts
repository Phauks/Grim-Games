import { SEATED_TYPES } from '../types.ts';
import { enumPart } from './part.ts';

/**
 * Its player has the ability of a not-in-play character of this type, so that character's
 * setup change applies too: the Alchemist's Minion ability
 * (https://wiki.bloodontheclocktower.com/Alchemist). Sushi Buffet asks which when it is
 * drafted, or later, as Grimbits' draft tool does (`modes/draft.ts`).
 */
export const gainsAbilityOf = enumPart(
	'Gains the ability of',
	'Its player has the ability of a not-in-play character of this type.',
	SEATED_TYPES
);
