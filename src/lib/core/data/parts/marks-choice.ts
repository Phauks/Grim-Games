import { TOKENS } from '../field-spec.ts';
import { specPart } from './part.ts';

/** Its reminders that mark whom it chose last night (the Monk's Safe, the Poisoner's Poisoned). */
export const marksChoice = specPart(
	'night',
	'Marks its choice',
	'Its reminders that mark whom it chose last night.',
	TOKENS
);
