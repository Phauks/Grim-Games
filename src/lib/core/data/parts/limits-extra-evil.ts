import { truePart } from './part.ts';

/**
 * While it is in play there can't be more than 1 extra evil player (the Spirit of Ivory,
 * https://wiki.bloodontheclocktower.com/Spirit_of_Ivory): turning a second good-type
 * player evil warns, never blocks.
 */
export const limitsExtraEvil = truePart(
	'Limits extra evil',
	'While it is in play there can’t be more than one extra evil player.'
);
