import { readGivesAbility } from '../gives-ability-rules.ts';
import { objectPart } from './part.ts';

/** It gives another player an ability held without its token (`gives-ability-rules.ts`). */
export const givesAbility = objectPart(
	'Gives an ability',
	'It gives another player an ability held without its token.',
	readGivesAbility
);
