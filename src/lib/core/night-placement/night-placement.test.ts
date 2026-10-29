/**
 * The night placement recommender (L74) checked against TPI's night sheet, from each official
 * character's ability text alone, as a homebrew character would be placed. Band fit: how many
 * official characters' text picks the band the sheet puts them in. Leave-one-out: each is
 * taken out of the sheet and placed from the others. The numbers only tighten.
 *
 * Basis: TPI's night sheet and ability text (committed game data).
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import {
	bandOf,
	MARKERS,
	placementReason,
	recommendPlacement,
	sheetBands,
	textSignature,
	type Night
} from './index.ts';

const data = committedGameData();
const signatures = (night: Night) => {
	const cache = new Map<string, Set<string>>();
	return (id: string) => {
		const character = data.byId.get(id);
		if (!character) return undefined;
		if (!cache.has(id)) cache.set(id, textSignature(character.ability, character.type, night));
		return cache.get(id);
	};
};
const nameOf = (id: string) => data.byId.get(id)?.name ?? id;

function measure(night: Night) {
	const order = data.nightSheet[night];
	const signatureOf = signatures(night);
	const labels = sheetBands(order, night, signatureOf);
	let fit = 0;
	const offs: number[] = [];
	for (const [i, id] of order.entries()) {
		const mine = signatureOf(id);
		if (MARKERS.includes(id) || !mine) continue;
		if (bandOf(mine, night) === labels[i]) fit++;
		const rest = order.filter((other) => other !== id);
		const placed = recommendPlacement(mine, night, rest, signatureOf);
		if (placed) offs.push(Math.abs(placed.index - i));
	}
	offs.sort((a, b) => a - b);
	return {
		characters: offs.length,
		fit,
		medianOff: offs[offs.length >> 1],
		within5: offs.filter((o) => o <= 5).length
	};
}

describe('night placement from ability text', () => {
	// Measured 2026-10-29; raise a floor or lower a ceiling when it gets better.
	const EXPECT = {
		firstNight: { fit: 66, medianOff: 2, within5: 49 },
		otherNight: { fit: 93, medianOff: 3, within5: 65 }
	};
	for (const night of ['firstNight', 'otherNight'] as const)
		it(`places official characters by TPI's ${night} sheet`, () => {
			const result = measure(night);
			console.log(night, JSON.stringify(result));
			expect(result.fit).toBeGreaterThanOrEqual(EXPECT[night].fit);
			expect(result.medianOff).toBeLessThanOrEqual(EXPECT[night].medianOff);
			expect(result.within5).toBeGreaterThanOrEqual(EXPECT[night].within5);
		});

	// A homebrew protector, worded as the Monk is (https://wiki.bloodontheclocktower.com/Monk).
	it('places a homebrew protector beside the Monk, and says why', () => {
		const order = data.nightSheet.otherNight;
		const warden = textSignature(
			'Each night*, choose a player (not yourself): they are safe from the Demon tonight.',
			'townsfolk',
			'otherNight'
		);
		const placed = recommendPlacement(warden, 'otherNight', order, signatures('otherNight'));
		expect(placed?.band).toBe('impairs');
		expect(Math.abs(placed!.index - order.indexOf('monk'))).toBeLessThanOrEqual(3);
		expect(placementReason(placed!, nameOf)).toMatch(
			/^Before the abilities it can poison, protect or take away, near the /
		);
	});
});
