import { readLearns } from '../night-info-rules.ts';
import { objectPart } from './part.ts';

/** First-night information the Storyteller picks from the truthful options (the Chef). */
export const learns = objectPart(
	'First-night information',
	'First-night information the Storyteller picks from the truthful options.',
	readLearns
);
