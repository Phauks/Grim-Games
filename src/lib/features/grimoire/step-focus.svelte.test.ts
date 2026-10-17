import { describe, expect, it } from 'vitest';
import { DEFAULT_STEP_FOCUS, parseStepFocus } from './step-focus.svelte.ts';

describe('parseStepFocus', () => {
	it('defaults to the step first, and keeps only valid values', () => {
		expect(parseStepFocus(null)).toEqual(DEFAULT_STEP_FOCUS);
		expect(parseStepFocus({ on: false, mode: 'only' })).toEqual({ on: false, mode: 'only' });
		expect(parseStepFocus({ on: 'x', mode: 'nope' })).toEqual({ on: true, mode: 'front' });
	});
});
