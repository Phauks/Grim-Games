import { describe, expect, it } from 'vitest';
import { foldForSearch } from './fold.ts';

describe('foldForSearch', () => {
	it('ignores case and accents', () => {
		expect(foldForSearch('Fée')).toBe('fee');
		expect(foldForSearch("LIL' MONSTA")).toBe("lil' monsta");
		expect(foldForSearch('Pukka')).toBe(foldForSearch('pükka'));
	});
});
