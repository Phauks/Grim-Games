import { readCountdown } from '../countdown-rules.ts';
import { objectPart } from './part.ts';

/** Its token counts down one step a night (`countdown-rules.ts`). */
export const countdown = objectPart(
	'Countdown',
	'Its token counts down one step a night.',
	readCountdown
);
