import { readMadness } from '../madness-rules.ts';
import { objectPart } from './part.ts';

/** A player it makes mad may be executed or die for breaking it (`madness-rules.ts`). */
export const madness = objectPart(
	'Madness',
	'A player it makes mad may be executed or die for breaking it.',
	readMadness
);
