import { booleanPart } from './part.ts';

/** Its player is told they are another character (the Lunatic thinks they are the Demon). */
export const believesOtherCharacter = booleanPart(
	'Believes another character',
	'Its player is told they are another character.'
);
