import { readKeepsAbility } from '../keeps-ability-rules.ts';
import { objectPart } from './part.ts';

/** Its token on a dead player keeps that player's ability (`keeps-ability-rules.ts`). */
export const keepsAbility = objectPart(
	'Keeps ability',
	'Its token on a dead player keeps that player’s ability.',
	readKeepsAbility
);
