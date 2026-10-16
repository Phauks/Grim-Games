import { describe, expect, it } from 'vitest';
import { nameBox } from './name-placement.ts';
import { fitReminders, reminderFan, reminderLayout } from './reminder-fan.ts';

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

describe('reminderLayout', () => {
	const box = (p: { x: number; y: number }) => ({ ...p, w: chip, h: chip });
	const clash = (a: { x: number; y: number }, b: { x: number; y: number }) =>
		Math.abs(a.x - b.x) < chip && Math.abs(a.y - b.y) < chip;

	it("keeps one seat's reminders off a crowded neighbour's (Trevor, 2026-10-16)", () => {
		// Fifteen seats round a phone-sized table, three reminders each.
		const seats = Array.from({ length: 15 }, (_, i) => {
			const a = (i / 15) * 2 * Math.PI - Math.PI / 2;
			return {
				seat: { x: 200 + 170 * Math.cos(a), y: 300 + 260 * Math.sin(a) },
				middle: { x: 200, y: 300 },
				count: 3,
				size: 44,
				chip: 30
			};
		});
		const at = reminderLayout(seats);
		for (let i = 0; i < at.length; i++) {
			expect(at[i]).toHaveLength(3);
			for (let j = i + 1; j < at.length; j++)
				for (const p of at[i]) for (const q of at[j]) expect(clash(p, q)).toBe(false);
		}
		// Nor on another seat's token.
		for (let i = 0; i < at.length; i++)
			for (let j = 0; j < seats.length; j++)
				if (i !== j)
					for (const p of at[i]) {
						const t = { ...seats[j].seat, w: 44, h: 44 };
						const b = box(p);
						expect(
							Math.abs(b.x - t.x) < (b.w + t.w) / 2 && Math.abs(b.y - t.y) < (b.h + t.h) / 2
						).toBe(false);
					}
	});

	it('lays out one seat as reminderFan does', () => {
		const one = { seat, middle, count: 4, size, chip };
		expect(reminderLayout([one])[0]).toEqual(reminderFan(one));
	});

	it('makes reminders smaller rather than overlap on a very crowded board', () => {
		const seats = Array.from({ length: 15 }, (_, i) => {
			const a = (i / 15) * 2 * Math.PI - Math.PI / 2;
			return {
				seat: { x: 200 + 170 * Math.cos(a), y: 300 + 260 * Math.sin(a) },
				middle: { x: 200, y: 300 },
				count: 5,
				size: 44,
				chip: 30
			};
		});
		const { at, chip: fitted } = fitReminders(seats);
		expect(fitted).toBeLessThan(30);
		for (let i = 0; i < at.length; i++)
			for (let j = i + 1; j < at.length; j++)
				for (const p of at[i])
					for (const q of at[j])
						expect(Math.abs(p.x - q.x) < fitted && Math.abs(p.y - q.y) < fitted).toBe(false);
	});

	it('keeps every reminder on the board, so the page never scrolls sideways', () => {
		// A seat at the right edge with many reminders.
		const edge = {
			seat: { x: 370, y: 300 },
			middle: { x: 200, y: 300 },
			count: 12,
			size: 44,
			chip: 30
		};
		const { at, chip: fitted } = fitReminders([edge], [], { width: 390, height: 600 });
		for (const p of at[0]) {
			expect(p.x + fitted / 2).toBeLessThanOrEqual(390);
			expect(p.x - fitted / 2).toBeGreaterThanOrEqual(0);
		}
	});
});
