import { readNightText } from '../night-text-rules.ts';
import { objectPart } from './part.ts';

/** Our own night text in place of the original (`rules/night-text.ts`). */
export const nightText = objectPart(
	'Night text',
	'Our own night text in place of the original.',
	readNightText
);
