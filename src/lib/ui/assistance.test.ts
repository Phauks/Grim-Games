import { describe, expect, it } from 'vitest';
import { ASSIST_PRESETS, DEFAULT_ASSISTANCE, assistPreset, parseAssistance } from './assistance.ts';

describe('assistance', () => {
	it('defaults to the guided preset', () => {
		expect(assistPreset(DEFAULT_ASSISTANCE)).toBe('guided');
	});

	it('names each preset and calls anything else custom', () => {
		for (const id of Object.keys(ASSIST_PRESETS) as (keyof typeof ASSIST_PRESETS)[]) {
			expect(assistPreset({ ...ASSIST_PRESETS[id] })).toBe(id);
		}
		expect(assistPreset({ ...ASSIST_PRESETS.expert, nightAnswers: true })).toBe('custom');
	});

	it('the expert preset turns off the night walkthrough', () => {
		expect(ASSIST_PRESETS.expert.nightWalkthrough).toBe(false);
	});

	it('keeps valid switches and fills the rest with defaults', () => {
		expect(parseAssistance(null)).toEqual(DEFAULT_ASSISTANCE);
		expect(parseAssistance({ nightWalkthrough: false, nightAnswers: 'yes', bogus: true })).toEqual({
			...DEFAULT_ASSISTANCE,
			nightWalkthrough: false
		});
	});
});
