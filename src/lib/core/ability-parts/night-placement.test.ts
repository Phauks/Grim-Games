/**
 * SPIKE: the night placement recommender (`night-placement.ts`).
 *
 * Leave-one-out: each official character that wakes is taken out of TPI's night sheet and
 * placed from the others; the test holds how far they land from their real places to
 * ceilings that only drop. A custom character is placed beside the official one it copies.
 *
 * Basis: TPI's night sheet and the parts in this folder.
 */
import { describe, expect, it } from 'vitest';
import { Issues } from '#lib/core/data/validate.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { BAD_MOON_RISING_PARTS } from './bad-moon-rising/index.ts';
import { CAROUSEL_PARTS } from './carousel/index.ts';
import { FABLED_PARTS } from './fabled/index.ts';
import { LORIC_PARTS } from './loric/index.ts';
import { SECTS_AND_VIOLETS_PARTS } from './sects-and-violets/index.ts';
import { TROUBLE_BREWING_PARTS } from './trouble-brewing/index.ts';
import { placementReason, recommendPlacement, type Known, type Night } from './night-placement.ts';
import { readAbilityParts } from './read.ts';
import type { AbilityParts } from './types.ts';

const data = committedGameData();
const known = new Map<string, Known>();
for (const edition of [
	TROUBLE_BREWING_PARTS,
	BAD_MOON_RISING_PARTS,
	SECTS_AND_VIOLETS_PARTS,
	CAROUSEL_PARTS,
	FABLED_PARTS,
	LORIC_PARTS
])
	for (const [id, raw] of edition) {
		const parts = readAbilityParts(raw, id, new Issues());
		const character = data.byId.get(id);
		if (parts && character) known.set(id, { parts, type: character.type });
	}
const nameOf = (id: string) => data.byId.get(id)?.name ?? id;

/** How many places each waking official character lands from its own, left out in turn. */
function leaveOneOut(night: Night) {
	const order = data.nightSheet[night];
	const misses: { id: string; off: number }[] = [];
	for (const [i, id] of order.entries()) {
		const me = known.get(id);
		if (!me) continue;
		const rest = order.filter((other) => other !== id);
		const others = new Map([...known].filter(([other]) => other !== id));
		const placed = recommendPlacement(me.parts, me.type, night, rest, others);
		// On the sheet but its parts don't wake it: the wake test in ability-parts.test.ts covers it.
		if (placed) misses.push({ id, off: Math.abs(placed.index - i) });
	}
	const offs = misses.map((m) => m.off).sort((a, b) => a - b);
	return {
		placed: offs.length,
		median: offs[offs.length >> 1],
		mean: offs.reduce((a, b) => a + b, 0) / offs.length,
		within5: offs.filter((o) => o <= 5).length / offs.length,
		within10: offs.filter((o) => o <= 10).length / offs.length,
		worst: [...misses].sort((a, b) => b.off - a.off).slice(0, 5)
	};
}

describe('night placement from ability parts', () => {
	// Measured 2026-10-29; lower a ceiling when the recommender gets better.
	const CEILING = {
		firstNight: { median: 9, mean: 14.7 },
		otherNight: { median: 7, mean: 14.2 }
	};
	for (const night of ['firstNight', 'otherNight'] as const)
		it(`lands official characters near their place on TPI's ${night} sheet`, () => {
			const result = leaveOneOut(night);
			console.log(night, JSON.stringify(result));
			expect(result.placed).toBeGreaterThan(70);
			expect(result.median).toBeLessThanOrEqual(CEILING[night].median);
			expect(result.mean).toBeLessThanOrEqual(CEILING[night].mean);
		});

	it('places a custom protector beside the Monk, and says why', () => {
		const warden: AbilityParts = {
			clauses: [
				{
					id: 'protect',
					when: { at: 'night', nights: 'each*' },
					choose: { count: 1, what: 'player', notSelf: true },
					effects: [{ do: 'protect', who: 'chosen', from: 'demon', until: 'tonight' }]
				}
			]
		};
		const order = data.nightSheet.otherNight;
		const placed = recommendPlacement(warden, 'townsfolk', 'otherNight', order, known);
		expect(placed?.stage).toBe('protects');
		expect(Math.abs(placed!.index - order.indexOf('monk'))).toBeLessThanOrEqual(2);
		expect(placementReason(placed!, nameOf)).toBe(
			'Near the Monk, which also protects a player and chooses a player'
		);
		expect(recommendPlacement(warden, 'townsfolk', 'firstNight', order, known)).toBeUndefined();
	});
});
