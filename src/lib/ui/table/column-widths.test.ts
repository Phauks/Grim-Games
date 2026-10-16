import { describe, expect, it } from 'vitest';
import { MAX_WIDTH, MIN_WIDTH, clampWidth, columnTrack, parseWidths } from './column-widths.ts';

describe('clampWidth', () => {
	it('keeps widths between the limits', () => {
		expect(clampWidth(1)).toBe(MIN_WIDTH);
		expect(clampWidth(500)).toBe(MAX_WIDTH);
		expect(clampWidth(12)).toBe(12);
	});

	it('rounds to a quarter unit', () => {
		expect(clampWidth(10.13)).toBe(10.25);
		expect(clampWidth(10.1)).toBe(10);
	});

	it('honours a column minimum', () => {
		expect(clampWidth(5, 8)).toBe(8);
	});
});

describe('parseWidths', () => {
	it('keeps valid widths and drops the rest', () => {
		expect(parseWidths({ name: 14, type: 'wide', edition: -2, prep: Number.NaN, ok: 70 })).toEqual({
			name: 14,
			ok: MAX_WIDTH
		});
	});

	it('treats missing or odd storage as nothing saved', () => {
		expect(parseWidths(undefined)).toEqual({});
		expect(parseWidths('14')).toEqual({});
		expect(parseWidths([14])).toEqual({});
	});
});

describe('columnTrack', () => {
	it('uses the dragged width in units, else the column’s own track', () => {
		expect(columnTrack(12.5, '6rem')).toBe('calc(12.5 * var(--u))');
		expect(columnTrack(undefined, '6rem')).toBe('6rem');
	});
});
