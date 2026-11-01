import { readBecomes } from '../becomes-rules.ts';
import { objectPart } from './part.ts';

/** Its token says a player changed character or alignment (`becomes-rules.ts`). */
export const becomes = objectPart(
	'Becomes',
	'Its token says a player changed character or alignment.',
	readBecomes
);
