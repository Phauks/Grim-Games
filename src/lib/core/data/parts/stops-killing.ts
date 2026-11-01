import { readStopsWaking } from '../stops-waking-rules.ts';
import { objectPart } from './part.ts';

/** Its token on a player stops them killing tonight (`stops-waking-rules.ts`'s shape). */
export const stopsKilling = objectPart(
	'Stops killing',
	'Its token on a player stops them killing tonight.',
	readStopsWaking
);
