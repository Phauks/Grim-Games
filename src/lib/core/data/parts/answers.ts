import { readAnswers } from '../night-info-rules.ts';
import { objectPart } from './part.ts';

/** A night answer worked out from the grimoire and today's log (the Town Crier). */
export const answers = objectPart(
	'Night answer',
	'A night answer worked out from the grimoire and today’s log.',
	readAnswers
);
