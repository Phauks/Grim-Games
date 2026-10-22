import { describe, expect, it } from 'vitest';
import { fitTabs } from './tabs-fit.ts';

describe('fitTabs', () => {
	it('keeps every tab when the row has room', () => {
		expect(fitTabs([50, 50, 50], 150, 0, 40)).toBe(3);
		expect(fitTabs([50, 50, 50], 160, 5, 40)).toBe(3);
	});

	it('leaves room for the ⋯ button when some move to the menu', () => {
		// Two tabs (105 with the gap) + gap + ⋯ (40) = 150; three tabs (160) would not fit.
		expect(fitTabs([50, 50, 50], 150, 5, 40)).toBe(2);
		expect(fitTabs([50, 50, 50], 120, 5, 40)).toBe(1);
	});

	it('always keeps at least one tab', () => {
		expect(fitTabs([200, 50], 100, 0, 40)).toBe(1);
	});
});
