import { readGainedFrom } from '../gained-from-rules.ts';
import { objectPart } from './part.ts';

/** The ability it has is another player's, found by its token (`gained-from-rules.ts`). */
export const gainedFrom = objectPart(
	'Ability gained from',
	'The ability it has is another player’s, found by its token.',
	readGainedFrom
);
