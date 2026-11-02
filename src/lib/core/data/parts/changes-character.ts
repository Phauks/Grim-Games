import { readChangesCharacter } from '../becomes-rules.ts';
import { objectPart } from './part.ts';

/** Its night step makes a chosen player another character (`becomes-rules.ts`). */
export const changesCharacter = objectPart(
	'Changes character',
	'Its night step makes a chosen player another character.',
	readChangesCharacter
);
