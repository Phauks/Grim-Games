import { readWakesWhen } from '../wakes-when-rules.ts';
import { objectPart } from './part.ts';

/** A condition its player needs before waking for it (`wakes-when-rules.ts`). */
export const wakesWhen = objectPart(
	'Wakes when',
	'A condition its player needs before waking for it.',
	readWakesWhen
);
