import { readTokenFlow } from '../token-flow-rules.ts';
import { objectPart } from './part.ts';

/** Its tokens that take each other's place on a player, in order (`token-flow-rules.ts`). */
export const tokenFlow = objectPart(
	'Token flow',
	'Its tokens that take the place of the one before on the same player, in order.',
	readTokenFlow
);
