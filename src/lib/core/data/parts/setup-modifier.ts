import { readSetupModifier } from '../setup-modifier-rules.ts';
import { objectPart } from './part.ts';

/** How its [bracketed] text changes which characters are dealt (`rules/setup-modifiers.ts`). */
export const setupModifier = objectPart(
	'Setup change',
	'How its bracketed text changes which characters are dealt.',
	readSetupModifier
);
