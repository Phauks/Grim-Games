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
	const box = (p: { x: number; y: number }, w: number) => ({ ...p, w, h: w });

	it("keeps one seat's reminders off a crowded neighbour's (Trevor, 2026-10-16)", () => {
		// Fifteen seats round a phone-sized table, two reminders each.
		const seats = Array.from({ length: 15 }, (_, i) => {
			const a = (i / 15) * 2 * Math.PI - Math.PI / 2;
			return {
				seat: { x: 200 + 170 * Math.cos(a), y: 300 + 260 * Math.sin(a) },
				middle: { x: 200, y: 300 },
				count: 2,
				size: 44,
				chip: 30
			};
		});
		const fitted = 30;
		const { at } = fitReminders(seats);
		const clash = (a: { x: number; y: number }, b: { x: number; y: number }) =>
			Math.abs(a.x - b.x) < fitted && Math.abs(a.y - b.y) < fitted;
		for (let i = 0; i < at.length; i++) {
			expect(at[i]).toHaveLength(2);
			for (let j = i + 1; j < at.length; j++)
				for (const p of at[i]) for (const q of at[j]) expect(clash(p, q)).toBe(false);
		}
		// Nor on another seat's token.
		for (let i = 0; i < at.length; i++)
			for (let j = 0; j < seats.length; j++)
				if (i !== j)
					for (const p of at[i]) {
						const t = { ...seats[j].seat, w: 44, h: 44 };
						const b = box(p, fitted);
						expect(
							Math.abs(b.x - t.x) < (b.w + t.w) / 2 && Math.abs(b.y - t.y) < (b.h + t.h) / 2
						).toBe(false);
					}
	});

	it('lays out one seat as reminderFan does', () => {
		const one = { seat, middle, count: 4, size, chip };
		expect(reminderLayout([one])[0]).toEqual(reminderFan(one));
	});

	it('says when a very crowded board has no clear room left', () => {
		const seats = Array.from({ length: 15 }, (_, i) => {
			const a = (i / 15) * 2 * Math.PI - Math.PI / 2;
			return {
				seat: { x: 200 + 170 * Math.cos(a), y: 300 + 260 * Math.sin(a) },
				middle: { x: 200, y: 300 },
				count: 10,
				size: 44,
				chip: 44
			};
		});
		// 150 reminders of 44px need more room than the whole 400 by 600 board.
		const { at, fits } = fitReminders(seats, [], { width: 400, height: 600 });
		expect(fits).toBe(false);
		// Every reminder is still shown.
		for (const points of at) expect(points).toHaveLength(10);
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
		const fitted = edge.chip;
		const { at } = fitReminders([edge], [], { width: 390, height: 600 });
		for (const p of at[0]) {
			expect(p.x + fitted / 2).toBeLessThanOrEqual(390);
			expect(p.x - fitted / 2).toBeGreaterThanOrEqual(0);
		}
	});

	it('puts each reminder nearer its own seat than any other (Trevor, 2026-10-17)', () => {
		// Big tokens on a small table: twelve seats, two or three reminders each.
		const seats = Array.from({ length: 12 }, (_, i) => {
			const a = (i / 12) * 2 * Math.PI - Math.PI / 2;
			return {
				seat: { x: 200 + 150 * Math.cos(a), y: 260 + 200 * Math.sin(a) },
				middle: { x: 200, y: 260 },
				count: 2 + (i % 2),
				size: 70,
				chip: 34
			};
		});
		const { at } = fitReminders(seats, [], { width: 400, height: 520 });
		const d2 = (p: { x: number; y: number }, q: { x: number; y: number }) =>
			(p.x - q.x) ** 2 + (p.y - q.y) ** 2;
		at.forEach((points, i) => {
			for (const p of points)
				for (let j = 0; j < seats.length; j++)
					if (j !== i) expect(d2(p, seats[i].seat)).toBeLessThan(d2(p, seats[j].seat));
		});
	});
	it('on a crowded phone table, goes over the edge of its own token before leaning towards a neighbour', () => {
		// Fifteen seats on a phone, neighbours 4 and 5 holding four and three reminders: the
		// board as the crowded-table e2e test lays it out.
		const seats = [
			[187, 61.17765055011231, 0, 187, 89.1776505501123, 50.4, 10.08],
			[
				259.26659050126733, 86.00000000000001, 0, 259.26659050126733, 114.00000000000001, 50.4,
				10.08
			],
			[
				308.83544173941726, 143.7926526865232, 0, 308.83544173941726, 171.7926526865232, 50.4, 10.08
			],
			[330, 215.00658058457702, 4, 271.48, 215.00658058457702, 57.040000000000006, 22],
			[330, 290.4420263896466, 3, 271.48, 290.4420263896466, 57.040000000000006, 22],
			[
				324.5169654933981, 364.55567983996576, 0, 265.99696549339814, 364.55567983996576,
				57.040000000000006, 22
			],
			[
				287.2163560169205, 430.69568533297615, 0, 287.2163560169205, 471.69568533297615,
				57.040000000000006, 22
			],
			[
				225.20681781713327, 475.19732828953755, 0, 225.20681781713327, 516.1973282895376,
				57.040000000000006, 22
			],
			[
				148.79318218286622, 475.1973282895374, 0, 148.79318218286622, 516.1973282895374,
				57.040000000000006, 22
			],
			[
				86.78364398307964, 430.6956853329762, 0, 86.78364398307964, 471.6956853329762,
				64.08000000000001, 22
			],
			[
				49.48303450660209, 364.5556798399663, 0, 111.52303450660209, 364.5556798399663,
				64.08000000000001, 22
			],
			[43.99999999999999, 290.4420263896468, 0, 106.04, 290.4420263896468, 64.08000000000001, 22],
			[43.99999999999999, 215.00658058457708, 0, 106.04, 215.00658058457708, 64.08000000000001, 22],
			[
				65.16455826058272, 143.79265268652333, 0, 127.20455826058273, 143.79265268652333,
				64.08000000000001, 22
			],
			[
				114.73340949873271, 86.00000000000001, 0, 114.73340949873271, 45.000000000000014,
				64.08000000000001, 22
			]
		].map(([x, y, count, ax, ay, aw, ah]) => ({
			seat: { x, y },
			middle: { x: 187, y: 264 },
			count,
			size: 56,
			chip: 44,
			avoid: [{ x: ax, y: ay, w: aw, h: ah }]
		}));
		const blocked = [
			{ x: 305, y: 23, w: 150, h: 58 },
			{ x: 21.5, y: 494, w: 55, h: 80 }
		];
		const { at } = fitReminders(seats, blocked, { width: 374, height: 528 });
		const d2 = (p: { x: number; y: number }, q: { x: number; y: number }) =>
			(p.x - q.x) ** 2 + (p.y - q.y) ** 2;
		expect(at[3]).toHaveLength(4);
		expect(at[4]).toHaveLength(3);
		// Each of the two neighbours' reminders is nearer its own seat than the other's.
		for (const p of at[3]) expect(d2(p, seats[3].seat)).toBeLessThan(d2(p, seats[4].seat));
		for (const p of at[4]) expect(d2(p, seats[4].seat)).toBeLessThan(d2(p, seats[3].seat));
	});
});
