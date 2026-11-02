import { describe, expect, it } from 'vitest';
import {
	MAX_DETAILS,
	MAX_DETAIL_LABEL,
	MAX_TAGLINE,
	parseDetails,
	parseProfileWords,
	parseTagline,
	sameDetails
} from './index.ts';

describe('profile words', () => {
	it('keeps a tag-line on one line, trimmed and capped', () => {
		expect(parseTagline('  Always   the\nEmpath ')).toBe('Always the Empath');
		expect(parseTagline('   ')).toBeUndefined();
		expect(parseTagline(42)).toBeUndefined();
		expect(parseTagline('x'.repeat(MAX_TAGLINE + 5))).toHaveLength(MAX_TAGLINE);
	});

	it('keeps details with both a label and text, up to the limit', () => {
		expect(parseDetails('nope')).toBeUndefined();
		expect(parseDetails([])).toBeUndefined();
		expect(
			parseDetails([
				{ label: 'Favorite script', text: 'Trouble Brewing' },
				{ label: 'Empty', text: '  ' },
				{ label: '', text: 'No label' },
				null,
				{ label: 'L'.repeat(MAX_DETAIL_LABEL + 3), text: 'Long label' }
			])
		).toEqual([
			{ label: 'Favorite script', text: 'Trouble Brewing' },
			{ label: 'L'.repeat(MAX_DETAIL_LABEL), text: 'Long label' }
		]);
		const many = Array.from({ length: MAX_DETAILS + 2 }, (_, i) => ({ label: `L${i}`, text: 't' }));
		expect(parseDetails(many)).toHaveLength(MAX_DETAILS);
	});

	it('leaves out the parts a player wrote nothing for', () => {
		expect(parseProfileWords({})).toEqual({});
		expect(parseProfileWords({ tagline: 'Hi', details: [] })).toEqual({ tagline: 'Hi' });
	});

	it('compares details in order', () => {
		const a = [{ label: 'A', text: '1' }];
		expect(sameDetails(undefined, [])).toBe(true);
		expect(sameDetails(a, [{ label: 'A', text: '1' }])).toBe(true);
		expect(sameDetails(a, [{ label: 'A', text: '2' }])).toBe(false);
		expect(sameDetails(a, undefined)).toBe(false);
	});
});
