import { describe, expect, it } from 'vitest';
import { readWorldCupAnswer, withEntryLogo, WORLD_CUPS } from './world-cup.ts';

describe('readWorldCupAnswer', () => {
	it('reads our stored copy and leaves out anything that is not a script', () => {
		expect(
			readWorldCupAnswer({
				scripts: [
					{ scriptId: 6687, version: '1.0.0', json: [{ id: '_meta' }] },
					{ scriptId: 'x', version: '1', json: [] },
					{ scriptId: 1, version: '1', json: {} }
				]
			})
		).toEqual([{ scriptId: 6687, version: '1.0.0', json: [{ id: '_meta' }] }]);
		expect(readWorldCupAnswer({ error: 'down' })).toBeUndefined();
	});
});

describe('withEntryLogo', () => {
	const logo = 'https://release.botc.app/wc25/seat7/logo.webp';
	it("adds the entry's logo to a script whose _meta has none", () => {
		expect(withEntryLogo([{ id: '_meta', name: 'Seat 7' }, 'mayor'], logo)).toEqual([
			{ id: '_meta', name: 'Seat 7', logo },
			'mayor'
		]);
		expect(withEntryLogo(['mayor'], logo)).toEqual([{ id: '_meta', logo }, 'mayor']);
	});
	it("keeps the author's own logo, and changes nothing without an entry logo", () => {
		const own = [{ id: '_meta', logo: 'https://author.example/logo.png' }, 'mayor'];
		expect(withEntryLogo(own, logo)).toBe(own);
		expect(withEntryLogo(['mayor'], undefined)).toEqual(['mayor']);
	});
	it("names TPI's hosted logo for the 2025 finalists found there", () => {
		const logos = WORLD_CUPS['2025'].entries.filter((e) => e.logo);
		expect(logos).toHaveLength(14);
		for (const e of logos)
			expect(e.logo).toMatch(/^https:\/\/release\.botc\.app\/wc25\/\w+\/logo\.webp$/);
	});
});
