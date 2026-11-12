import { COUNT } from '../field-spec.ts';
import { specPart } from './part.ts';

/**
 * Its player may make this many more nominations each day after the day's first execution,
 * even if they already nominated, and of a player already nominated today (the Butcher,
 * https://wiki.bloodontheclocktower.com/Butcher).
 */
export const nominationsAfterExecution = specPart(
	'day',
	'Nominations after an execution',
	'More nominations its player may make each day after the first execution.',
	COUNT
);
