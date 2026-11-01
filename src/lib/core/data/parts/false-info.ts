import { readFalseInfo } from '../false-info-rules.ts';
import { objectPart } from './part.ts';

/**
 * Its information rule (`false-info-rules.ts`): these types' information must be false.
 */
export const falseInfo = objectPart(
	'False information',
	'These character types’ information must be false.',
	readFalseInfo
);
