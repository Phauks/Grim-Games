import { readMadAs } from '../mad-as-rules.ts';
import { objectPart } from './part.ts';

/** The character a player is mad as, found by its token (`mad-as-rules.ts`). */
export const madAs = objectPart(
	'Mad as',
	'The character a player is mad as, found by its token.',
	readMadAs
);
