import { describe, expect, it } from 'vitest';
import { seatProfileRows } from './seat-profile.ts';

const values = (frame: string | undefined) =>
	Object.fromEntries(seatProfileRows(frame).map((row) => [row.id, row.value]));

describe("a player's profile rows", () => {
	it('names their laurel, its plain colour and its motion', () => {
		expect(values('ring-townsfolk~pulse')).toEqual({
			laurel: 'Simple ring',
			colour: 'Blue',
			motion: 'Pulse'
		});
	});

	// Trevor, 2026-10-28: show the colour itself, not how it would be applied.
	it('shows the colour as a swatch beside its name', () => {
		const colour = seatProfileRows('ring-gold').find((row) => row.id === 'colour');
		expect(colour?.swatch).toMatch(/^oklch\(/);
	});

	it('says None for a player with no laurel, keeping every row in place', () => {
		for (const frame of [undefined, 'none']) {
			expect(values(frame)).toEqual({ laurel: 'None', colour: 'None', motion: 'None' });
			expect(seatProfileRows(frame).some((row) => row.swatch)).toBe(false);
		}
	});
});
