import { describe, expect, it } from 'vitest';
import { nameBox } from './name-placement.ts';
import { reminderFan } from './reminder-fan.ts';

const middle = { x: 300, y: 300 };
const seat = { x: 300, y: 60 };
const size = 60;
const chip = 30;

const apart = (a: { x: number; y: number }, b: { x: number; y: number }) =>
	Math.abs(a.x - b.x) >= chip || Math.abs(a.y - b.y) >= chip;

describe('reminderFan', () => {
	it('lines a few reminders up towards the middle', () => {
		const at = reminderFan({ seat, middle, count: 3, size, chip });
		expect(at.map((p) => p.x)).toEqual([300, 300, 300]);
		expect(at[0].y).toBeGreaterThan(seat.y + size / 2);
		expect(at[1].y).toBeGreaterThan(at[0].y);
	});

	it('shows every reminder, however many, without stacking them', () => {
		const at = reminderFan({ seat, middle, count: 14, size, chip });
		expect(at).toHaveLength(14);
		for (let i = 0; i < at.length; i++)
			for (let j = i + 1; j < at.length; j++) expect(apart(at[i], at[j])).toBe(true);
		// Nothing goes past the middle of the table.
		for (const p of at) expect(p.y).toBeLessThan(middle.y);
	});

	it('keeps clear of the seat name beneath the token', () => {
		const name = nameBox(seat, 'below', size, 80, 18);
		const at = reminderFan({ seat, middle, count: 8, size, chip, avoid: [name] });
		for (const p of at) {
			const clear =
				Math.abs(p.x - name.x) >= (chip + name.w) / 2 ||
				Math.abs(p.y - name.y) >= (chip + name.h) / 2;
			expect(clear).toBe(true);
		}
	});
});
