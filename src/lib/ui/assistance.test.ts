import { describe, expect, it } from 'vitest';
import {
	ASSIST_KEYS,
	ASSIST_LABELS,
	ASSIST_PRESETS,
	DEFAULT_ASSISTANCE,
	assistPreset,
	parseAssistance
} from './assistance.ts';

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

	it('suggests setup reminders in Guided and Standard, not in Expert', () => {
		expect(ASSIST_KEYS).toContain('setupReminders');
		expect(ASSIST_LABELS.setupReminders.label).toBe('Suggest setup reminders');
		expect(ASSIST_PRESETS.guided.setupReminders).toBe(true);
		expect(ASSIST_PRESETS.standard.setupReminders).toBe(true);
		expect(ASSIST_PRESETS.expert.setupReminders).toBe(false);
		expect(DEFAULT_ASSISTANCE.setupReminders).toBe(true);
	});

	it('fills a switch missing from saved settings from the preset they match', () => {
		const { setupReminders: _expert, ...expert } = ASSIST_PRESETS.expert;
		expect(parseAssistance(expert)).toEqual(ASSIST_PRESETS.expert);
		const { setupReminders: _standard, ...standard } = ASSIST_PRESETS.standard;
		expect(parseAssistance(standard)).toEqual(ASSIST_PRESETS.standard);
		const custom = { ...expert, nightAnswers: true };
		expect(parseAssistance(custom).setupReminders).toBe(DEFAULT_ASSISTANCE.setupReminders);
	});

	it('keeps valid switches and fills the rest with defaults', () => {
		expect(parseAssistance(null)).toEqual(DEFAULT_ASSISTANCE);
		expect(parseAssistance({ nightWalkthrough: false, nightAnswers: 'yes', bogus: true })).toEqual({
			...DEFAULT_ASSISTANCE,
			nightWalkthrough: false
		});
	});
});
