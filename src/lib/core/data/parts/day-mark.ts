import { readDayMark } from '../day-mark-rules.ts';
import { objectPart } from './part.ts';

/** A fact about today the Storyteller marks for its night answer (`rules/day-marks.ts`). */
export const dayMark = objectPart(
	'Day mark',
	'A fact about today the Storyteller marks for its night answer.',
	readDayMark
);
