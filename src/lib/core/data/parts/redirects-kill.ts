import { obj, oneOf } from '../field-spec.ts';
import { specPart } from './part.ts';
import { PROTECTS_FROM } from './protects.ts';

/** A kill on its player, by `from`, may land on another player instead (the Mayor). */
export const redirectsKill = specPart(
	'Redirects a kill',
	'A kill on its player may land on another player instead.',
	obj({ from: oneOf(PROTECTS_FROM) })
);
