import { booleanPart } from './part.ts';

/**
 * The ability can make an extra evil player: turn a good player evil or bring one more evil
 * player in, as the Spirit of Ivory limits (https://wiki.bloodontheclocktower.com/Spirit_of_Ivory).
 * Sushi Buffet's Ivory draft drafts at most one such character (`modes/draft.ts`).
 */
export const makesExtraEvil = booleanPart(
	'Makes extra evil',
	'The ability can make an extra evil player.'
);
