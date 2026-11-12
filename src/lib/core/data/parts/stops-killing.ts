import { specPart } from './part.ts';
import { TOKEN_ON_TYPE } from './stops-waking.ts';

/** Its token on a player stops them killing tonight (the same shape as `stopsWaking`). */
export const stopsKilling = specPart(
	'deaths',
	'Stops killing',
	'Its token on a player stops them killing tonight.',
	TOKEN_ON_TYPE
);
