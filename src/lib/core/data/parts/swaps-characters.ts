import { anyOf, oneOf, optObj } from '../field-spec.ts';
import { SEATED_TYPES } from '../types.ts';
import { specPart } from './part.ts';

/**
 * On its night step, two chosen players swap characters and keep
 * their alignments (the Barber's haircuts, the Demon choosing,
 * https://wiki.bloodontheclocktower.com/Barber). `notTypes` are the character types that may
 * not be chosen (the Barber's "not another Demon"); `chooser` is the character type of the
 * player who chooses, who may still choose themself (the Demon swapping itself).
 */
export const swapsCharacters = specPart(
	'Swaps characters',
	'Its night step swaps two chosen players’ characters.',
	optObj({ notTypes: anyOf(SEATED_TYPES), chooser: oneOf(SEATED_TYPES) })
);
