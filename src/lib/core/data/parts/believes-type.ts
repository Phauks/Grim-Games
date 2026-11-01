import { SEATED_TYPES } from '../types.ts';
import { enumPart } from './part.ts';

/**
 * The type of character its player is shown instead of its own (the Lunatic thinks they are
 * the Demon, https://wiki.bloodontheclocktower.com/Lunatic): its bag tile asks which, and a
 * second bluff set is theirs.
 */
export const believesType = enumPart(
	'Believes type',
	'The type of character its player is shown instead of its own.',
	SEATED_TYPES
);
