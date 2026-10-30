import { describe, expect, it } from 'vitest';
import { PRINT_DEFAULTS, readPrint } from './player-settings.svelte.ts';

// Trevor, 2026-10-29: paper and margins, and a Front and a Back with a switch per item, in
// place of the Back drop-down's bundles and the number of copies.
describe('print settings', () => {
	it('defaults to Letter with half-inch margins and the night order back', () => {
		expect(readPrint(undefined)).toEqual(PRINT_DEFAULTS);
		expect(PRINT_DEFAULTS.pageSize).toBe('letter');
		expect(PRINT_DEFAULTS.margin).toBeCloseTo(12.7);
		expect(PRINT_DEFAULTS.marginUnit).toBe('in');
		expect(PRINT_DEFAULTS.underlines).toBe(false);
	});

	it("keeps an older build's front choices and drops its copies", () => {
		const read = readPrint({
			columns: 'two',
			density: 'compact',
			nightStrips: false,
			jinxes: false,
			back: 'night',
			copies: 6
		});
		expect(read.front).toMatchObject({
			columns: 'two',
			density: 'compact',
			nightStrips: false,
			jinxes: false
		});
		expect(read.back).toMatchObject({ enabled: true, night: true, counts: true });
		expect(read).not.toHaveProperty('copies');
	});

	it('turns the info back into its switches, with Fabled and Loric off the front', () => {
		const read = readPrint({ back: 'info' });
		expect(read.back).toMatchObject({
			enabled: true,
			night: false,
			counts: false,
			jinxes: true,
			ruleCharacters: true
		});
		expect(read.front.ruleCharacters).toBe(false);
	});

	it('reads no back, from the drop-down or the older switch', () => {
		expect(readPrint({ back: 'none' }).back.enabled).toBe(false);
		expect(readPrint({ back: false }).back.enabled).toBe(false);
		expect(readPrint({ back: true }).back.enabled).toBe(true);
	});

	it('keeps margins and icon sizes in range', () => {
		const read = readPrint({
			margin: 90,
			front: { iconScale: 9 },
			back: { iconScale: 0.1 },
			pageSize: 'legal'
		});
		expect(read.margin).toBeCloseTo(25.4);
		expect(read.front.iconScale).toBe(1.5);
		expect(read.back.iconScale).toBe(0.6);
		expect(read.pageSize).toBe('letter');
	});
});
