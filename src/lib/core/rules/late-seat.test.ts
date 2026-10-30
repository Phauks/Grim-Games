import { describe, expect, it } from 'vitest';
import {
	BASE_DISTRIBUTION,
	SEATED_TYPES,
	type SeatedType,
	type TypeCounts
} from './distribution.ts';
import {
	countByType,
	planLateSeat,
	type LateSeatInput,
	type LateSeatPlan,
	type SeenSeat,
	type UndrawnTile
} from './late-seat.ts';

/** A seeded generator (mulberry32), so every run deals the same games. */
function seeded(seed = 1) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
	};
}

/** Script sizes like Trouble Brewing's: 13 Townsfolk, 4 Outsiders, 4 Minions, 4 Demons. */
const SCRIPT: TypeCounts = { townsfolk: 13, outsider: 4, minion: 4, demon: 4 };

/** A shuffled deal of `counts`, the first `seen` of them already looked at. */
function deal(counts: TypeCounts, seen: number, random: () => number) {
	const tiles: { characterId: string; type: SeatedType }[] = [];
	for (const type of SEATED_TYPES)
		for (let i = 0; i < counts[type]; i++) tiles.push({ characterId: `${type}-${i}`, type });
	for (let i = tiles.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[tiles[i], tiles[j]] = [tiles[j], tiles[i]];
	}
	const seenSeats: SeenSeat[] = tiles.slice(0, seen).map((t, i) => ({ ...t, seatId: `s${i}` }));
	const bag: UndrawnTile[] = tiles.slice(seen).map((t, i) => ({ ...t, tileId: `t${i}` }));
	return { seen: seenSeats, bag };
}

/** The drawn players' types and the bag's types once the plan is carried out. */
function apply(input: LateSeatInput, plan: LateSeatPlan) {
	const to = new Map(plan.changes.map((c) => [c.seatId, c.toType]));
	const seen = input.seen.map((s) => to.get(s.seatId) ?? s.type);
	const removed = new Set(plan.removedTiles);
	const typeOf = (id: string) => input.seen.find((s) => s.characterId === id)!.type;
	const bag = [
		...input.bag.filter((t) => !removed.has(t.tileId)).map((t) => t.type),
		...plan.addTiles,
		...plan.returned.map(typeOf)
	];
	return { seen, bag };
}

const key = (counts: TypeCounts) => SEATED_TYPES.map((t) => counts[t]).join('/');

function choose(n: number, k: number): number {
	let r = 1;
	for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
	return r;
}

/** How the drawn seats' types fall in a fresh deal of `counts`, exactly. */
function freshOdds(counts: TypeCounts, seen: number): Map<string, number> {
	const total = SEATED_TYPES.reduce((s, t) => s + counts[t], 0);
	const odds = new Map<string, number>();
	const walk = (i: number, left: number, picked: number[], ways: number) => {
		if (i === SEATED_TYPES.length) {
			if (left === 0) odds.set(picked.join('/'), ways / choose(total, seen));
			return;
		}
		const have = counts[SEATED_TYPES[i]];
		for (let n = 0; n <= Math.min(have, left); n++)
			walk(i + 1, left - n, [...picked, n], ways * choose(have, n));
	};
	walk(0, seen, [], 1);
	return odds;
}

/** Plays the late seat many times and returns how far it is from a fresh deal. */
function distanceFromFresh(from: number, target: TypeCounts, seen: number, trials = 30_000) {
	const random = seeded(from * 100 + seen);
	const counted = new Map<string, number>();
	for (let i = 0; i < trials; i++) {
		const input: LateSeatInput = {
			...deal(BASE_DISTRIBUTION[from], seen, random),
			target,
			scriptCounts: SCRIPT,
			demonStays: false,
			random
		};
		const k = key(countByType(apply(input, planLateSeat(input)).seen));
		counted.set(k, (counted.get(k) ?? 0) + 1);
	}
	const fresh = freshOdds(target, seen);
	let distance = 0;
	for (const k of new Set([...fresh.keys(), ...counted.keys()]))
		distance += Math.abs((fresh.get(k) ?? 0) - (counted.get(k) ?? 0) / trials);
	return distance / 2;
}

// Counts per player count from the setup sheet (https://wiki.bloodontheclocktower.com/Setup).
describe('planLateSeat', () => {
	it('deals drawn players exactly as a fresh draw would, at every count from 5 to 15', () => {
		for (let from = 5; from < 15; from++) {
			const seen = Math.floor(from / 2);
			expect(distanceFromFresh(from, BASE_DISTRIBUTION[from + 1], seen)).toBeLessThan(0.02);
		}
	});

	it('stays fair for several late players at once', () => {
		for (const [from, to, seen] of [
			[5, 7, 3],
			[9, 11, 6],
			[10, 13, 10],
			[12, 14, 8]
		]) {
			expect(distanceFromFresh(from, BASE_DISTRIBUTION[to], seen)).toBeLessThan(0.02);
		}
	});

	it('stays fair going from 12 to 13 at any point in the draw', () => {
		for (const seen of [1, 6, 9, 12]) {
			expect(distanceFromFresh(12, BASE_DISTRIBUTION[13], seen)).toBeLessThan(0.02);
		}
	});

	it('stays fair with the Sentinel keeping the old Outsider count', () => {
		// 10 → 11 with one Outsider fewer than the sheet: one more Townsfolk only.
		const target = { townsfolk: 8, outsider: 0, minion: 2, demon: 1 };
		expect(distanceFromFresh(10, target, 10)).toBeLessThan(0.02);
	});

	it('always ends on the new counts', () => {
		const random = seeded(3);
		for (let i = 0; i < 2000; i++) {
			const from = 5 + (i % 10);
			const seen = i % (from + 1);
			const input: LateSeatInput = {
				...deal(BASE_DISTRIBUTION[from], seen, random),
				target: BASE_DISTRIBUTION[from + 1],
				scriptCounts: SCRIPT,
				random
			};
			const after = apply(input, planLateSeat(input));
			expect(countByType([...after.seen, ...after.bag])).toEqual(BASE_DISTRIBUTION[from + 1]);
			expect(after.seen.length + after.bag.length).toBe(from + 1);
		}
	});

	it('never moves a drawn Demon', () => {
		const random = seeded(4);
		for (let i = 0; i < 3000; i++) {
			const input: LateSeatInput = {
				...deal(BASE_DISTRIBUTION[12], 12, random),
				target: BASE_DISTRIBUTION[13],
				scriptCounts: SCRIPT,
				random
			};
			const plan = planLateSeat(input);
			expect(plan.changes.some((c) => c.fromType === 'demon')).toBe(false);
		}
	});

	it('changes a drawn player only when the new count needs it', () => {
		// 12 → 13 with everyone drawn: both Outsiders must go, so their players change.
		const random = seeded(5);
		const input: LateSeatInput = {
			...deal(BASE_DISTRIBUTION[12], 12, random),
			target: BASE_DISTRIBUTION[13],
			scriptCounts: SCRIPT,
			random
		};
		const plan = planLateSeat(input);
		const outsiders = input.seen.filter((s) => s.type === 'outsider').map((s) => s.seatId);
		for (const seatId of outsiders) expect(plan.changes.map((c) => c.seatId)).toContain(seatId);
		expect(plan.changes.every((c) => c.toType !== 'outsider')).toBe(true);
	});

	it('keeps a character back in play only as often as any of its type is', () => {
		// 10 → 11: the Outsider lands on a drawn Townsfolk about 5 times in 11.
		const random = seeded(6);
		let back = 0;
		let gone = 0;
		for (let i = 0; i < 20_000; i++) {
			const input: LateSeatInput = {
				...deal(BASE_DISTRIBUTION[10], 5, random),
				target: BASE_DISTRIBUTION[11],
				scriptCounts: SCRIPT,
				random
			};
			const plan = planLateSeat(input);
			const types = (ids: string[]) => ids.filter((id) => id.startsWith('townsfolk'));
			back += types(plan.returned).length;
			gone += types(plan.replaced).length;
		}
		expect(back / (back + gone)).toBeCloseTo(7 / 13, 1);
	});

	it('never takes a character out of play that a setup modifier needs', () => {
		const random = seeded(7);
		const needed = (id: string) => id === 'townsfolk-0' || id === 'outsider-0';
		for (let i = 0; i < 3000; i++) {
			const input: LateSeatInput = {
				...deal(BASE_DISTRIBUTION[12], 6, random),
				target: BASE_DISTRIBUTION[13],
				scriptCounts: SCRIPT,
				keepInPlay: needed,
				random
			};
			const plan = planLateSeat(input);
			expect(plan.replaced.some(needed)).toBe(false);
			const changedFrom = plan.changes.filter((c) => !plan.returned.includes(c.from));
			expect(changedFrom.some((c) => needed(c.from) && c.fromType === 'outsider')).toBe(false);
		}
	});

	it('refuses counts that are not for more players', () => {
		const input: LateSeatInput = {
			...deal(BASE_DISTRIBUTION[10], 5, seeded()),
			target: BASE_DISTRIBUTION[10],
			scriptCounts: SCRIPT,
			random: seeded()
		};
		expect(() => planLateSeat(input)).toThrow(RangeError);
	});
});
