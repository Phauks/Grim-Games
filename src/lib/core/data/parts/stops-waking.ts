import { readStopsWaking } from '../stops-waking-rules.ts';
import { objectPart } from './part.ts';

/** Its token on a player stops them waking tonight (`stops-waking-rules.ts`). */
export const stopsWaking = objectPart(
	'Stops waking',
	'Its token on a player stops them waking tonight.',
	readStopsWaking
);
