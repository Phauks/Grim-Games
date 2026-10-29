/**
 * SPIKE: the night placement recommender (`night-placement.ts`).
 *
 * Leave-one-out: each official character that wakes is taken out of TPI's night sheet and
 * placed from the others. The tests count how many fit their band in the sheet and how far
 * they land from their real places, against floors and ceilings that only tighten. A custom character is placed beside the official one it copies.
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
import {
	bandOf,
	nightSignature,
	placementReason,
	recommendPlacement,
	sheetBands,
	type Known,
	type Night
} from './night-placement.ts';
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

/** Every waking official character's band, and the sheet's band at its place. */
function bandFit(night: Night) {
	const order = data.nightSheet[night];
	const labels = sheetBands(order, night, known);
	const misfits: string[] = [];
	let fit = 0;
	for (const [i, id] of order.entries()) {
		const me = known.get(id);
		if (!me) continue;
		const sig = nightSignature(me.parts, me.type, night);
		if (!sig.size) continue;
		if (bandOf(sig, night) === labels[i]) fit++;
		else misfits.push(id);
	}
	return { fit, misfits };
}

/** How far each waking official character lands from its own place, left out in turn. */
function leaveOneOut(night: Night) {
	const order = data.nightSheet[night];
	const labels = sheetBands(order, night, known);
	const offs: number[] = [];
	const inBand: number[] = [];
	for (const [i, id] of order.entries()) {
		const me = known.get(id);
		if (!me) continue;
		const rest = order.filter((other) => other !== id);
		const others = new Map([...known].filter(([other]) => other !== id));
		const placed = recommendPlacement(me.parts, me.type, night, rest, others);
		// On the sheet but its parts don't wake it: the wake test in ability-parts.test.ts covers it.
		if (!placed) continue;
		const off = Math.abs(placed.index - i);
		offs.push(off);
		// Within the band: how many of its band's steps sit between where it lands and its place.
		if (placed.band === labels[i]) inBand.push(off);
	}
	const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
	return {
		placed: offs.length,
		rightBand: inBand.length,
		medianOff: median(offs),
		within5: offs.filter((o) => o <= 5).length,
		medianOffInBand: median(inBand)
	};
}

describe('night placement from ability parts', () => {
	// Measured 2026-10-29; raise a floor or lower a ceiling when the recommender gets better.
	const EXPECT = {
		firstNight: { fit: 66, misfits: 10, rightBand: 66, medianOff: 2, medianOffInBand: 2 },
		otherNight: { fit: 95, misfits: 2, rightBand: 95, medianOff: 3, medianOffInBand: 3 }
	};
	for (const night of ['firstNight', 'otherNight'] as const) {
		it(`puts official characters in TPI's ${night} bands`, () => {
			const { fit, misfits } = bandFit(night);
			console.log(night, fit, misfits.join(', '));
			expect(fit).toBeGreaterThanOrEqual(EXPECT[night].fit);
			expect(misfits.length).toBeLessThanOrEqual(EXPECT[night].misfits);
		});
		it(`lands official characters near their place on TPI's ${night} sheet`, () => {
			const result = leaveOneOut(night);
			console.log(night, JSON.stringify(result));
			expect(result.rightBand).toBeGreaterThanOrEqual(EXPECT[night].rightBand);
			expect(result.medianOff).toBeLessThanOrEqual(EXPECT[night].medianOff);
			expect(result.medianOffInBand).toBeLessThanOrEqual(EXPECT[night].medianOffInBand);
		});
	}

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
		expect(placed?.band).toBe('impairs');
		expect(Math.abs(placed!.index - order.indexOf('monk'))).toBeLessThanOrEqual(2);
		expect(placementReason(placed!, nameOf)).toBe(
			'Before the abilities it can poison, protect or take away, near the Monk, which also protects a player and chooses a player'
		);
		expect(recommendPlacement(warden, 'townsfolk', 'firstNight', order, known)).toBeUndefined();
	});
});
