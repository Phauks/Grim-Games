import { describe, expect, it } from 'vitest';
import { CHANGE_CATEGORIES, RELEASES, releaseSections } from './changelog.ts';

describe('changelog', () => {
	it('lists every category in a fixed order, empty ones included', () => {
		const sections = releaseSections({
			version: '1.0.0',
			date: '2027-01-01',
			changes: { Fixed: ['A'] }
		});
		expect(sections.map((s) => s.category)).toEqual([...CHANGE_CATEGORIES]);
		expect(sections.find((s) => s.category === 'Fixed')?.items).toEqual(['A']);
		expect(sections.find((s) => s.category === 'Added')?.items).toEqual([]);
	});

	it('starts with an empty Unreleased block until 1.0', () => {
		expect(RELEASES[0]).toEqual({ version: null, date: null, changes: {} });
	});
});
