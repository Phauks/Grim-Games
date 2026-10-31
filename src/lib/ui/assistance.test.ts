import { describe, expect, it } from 'vitest';
import { ASSIST_KEYS, ASSIST_LABELS, DEFAULT_ASSISTANCE, parseAssistance } from './assistance.ts';

describe('assistance', () => {
	it('has a label for every switch and turns every kind of help on by default', () => {
		for (const key of ASSIST_KEYS) {
			expect(ASSIST_LABELS[key].label).toBeTruthy();
			// Stacking duplicate reminders is a display choice, and tracking nominations extra
			// record-keeping: both off until asked for.
			expect(DEFAULT_ASSISTANCE[key]).toBe(key !== 'stackReminders' && key !== 'trackNominations');
		}
		expect(ASSIST_LABELS.explainTerms.label).toBe(
			'Underline rules terms with glossary definitions'
		);
	});

	it('keeps valid switches and fills the rest with defaults', () => {
		expect(parseAssistance(null)).toEqual(DEFAULT_ASSISTANCE);
		expect(parseAssistance({ nightWalkthrough: false, nightAnswers: 'yes', bogus: true })).toEqual({
			...DEFAULT_ASSISTANCE,
			nightWalkthrough: false
		});
	});

	it('drops a removed switch from saved settings', () => {
		// Guide night steps never changed anything and was removed (Trevor, 2026-10-31).
		expect(parseAssistance({ nightGuide: false })).toEqual(DEFAULT_ASSISTANCE);
	});

	it('gives a switch added later its default, keeping the saved ones', () => {
		const saved = { ...DEFAULT_ASSISTANCE, nightAnswers: false } as Record<string, boolean>;
		delete saved.nightAnswers;
		saved.nightWalkthrough = false;
		expect(parseAssistance(saved)).toEqual({ ...DEFAULT_ASSISTANCE, nightWalkthrough: false });
	});
});
