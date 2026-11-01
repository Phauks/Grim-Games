import { readSetupPrep } from '../setup-prep-rules.ts';
import { objectPart } from './part.ts';

/** Tokens and steps to prepare before the first night (`rules/setup-reminders.ts`). */
export const setupPrep = objectPart(
	'Setup preparation',
	'Tokens and steps to prepare before the first night.',
	readSetupPrep
);
