/**
 * The Sushi Buffet draft: offers of 3 → 2 → 1, keep one, the rest discarded or recycled;
 * setup modifiers apply as drafted. https://grimbits.com/draft-buffet/
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { baseCounts } from '#lib/core/rules/distribution.ts';
import {
	canRefuse,
	refuseOffer,
	seatsLeft,
	startDraft,
	takeOffer,
	type DraftConfig
} from './draft.ts';

const data = committedGameData();
const tb = data.characters.filter((c) => c.edition === 'tb');
const config: DraftConfig = { offers: [3, 2, 1], recycleUnchosen: false, oneTypePerOffer: false };
/** A fixed sequence, so offers are repeatable. */
const seeded =
	(seed = 1) =>
	() =>
		((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

describe('offers', () => {
	it('start at three characters and shrink to one when refused', () => {
		const random = seeded();
		let s = startDraft(config, baseCounts(7), tb, random);
		expect(s.offer).toHaveLength(3);
		s = refuseOffer(s, random);
		expect(s.offer).toHaveLength(2);
		s = refuseOffer(s, random);
		expect(s.offer).toHaveLength(1);
		expect(canRefuse(s)).toBe(false);
		expect(refuseOffer(s, random)).toBe(s);
		expect(s.discarded).toHaveLength(5);
	});

	it('only offer types with an open slot, so a full draft matches the counts', () => {
		const random = seeded(7);
		const counts = baseCounts(7);
		let s = startDraft(
			config,
			counts,
			tb.filter((c) => c.id !== 'baron'),
			random
		);
		for (let n = 0; n < 20 && seatsLeft(s) > 0; n++) s = takeOffer(s, s.offer[0], random);
		expect(s.picks).toHaveLength(7);
		const byType = (type: string) =>
			s.picks.filter((id) => data.byId.get(id)?.type === type).length;
		expect(byType('townsfolk')).toBe(counts.townsfolk);
		expect(byType('demon')).toBe(1);
		expect(new Set(s.picks).size).toBe(7);
		expect(s.offer).toEqual([]);
	});

	it('bring discards back when a type with open slots has run out', () => {
		const random = seeded();
		let s = startDraft(config, baseCounts(5), tb, random);
		// Every Demon (the Imp) was discarded; the Demon slot is still open.
		s = {
			...s,
			pool: s.pool.filter((id) => id !== 'imp'),
			discarded: ['imp'],
			slots: { townsfolk: 0, outsider: 0, minion: 0, demon: 1 }
		};
		s = refuseOffer({ ...s, offer: ['washerwoman'] }, random);
		expect(s.offer).toEqual(['imp']);
	});

	it('keep one type per offer when asked', () => {
		const random = seeded(3);
		let s = startDraft({ ...config, oneTypePerOffer: true }, baseCounts(8), tb, random);
		for (let n = 0; n < 5; n++) {
			expect(new Set(s.offer.map((id) => data.byId.get(id)?.type)).size).toBe(1);
			s = takeOffer(s, s.offer[0], random);
		}
	});

	it('put unchosen characters back in the pool when recycling', () => {
		const random = seeded(5);
		let s = startDraft({ ...config, recycleUnchosen: true }, baseCounts(7), tb, random);
		const [kept, ...others] = s.offer;
		s = takeOffer(s, kept, random);
		expect(s.discarded).toEqual([]);
		for (const id of others) expect(s.pool).toContain(id);
		expect(s.pool).not.toContain(kept);
	});
});

describe('setup modifiers in a draft', () => {
	// Trevor, 2026-10-19: "There is no automatic changes of the count of players".
	it('a drafted Baron changes no counts (https://wiki.bloodontheclocktower.com/Baron)', () => {
		const random = seeded();
		let s = startDraft(config, baseCounts(8), tb, random);
		s = { ...s, offer: ['baron'] };
		s = takeOffer(s, 'baron', random);
		expect(s.slots).toEqual({ townsfolk: 5, outsider: 1, minion: 0, demon: 1 });
	});

	it('a drafted Godfather changes no counts (https://wiki.bloodontheclocktower.com/Godfather)', () => {
		const random = seeded();
		const bmr = data.characters.filter((c) => c.edition === 'bmr');
		let s = startDraft(config, baseCounts(8), bmr, random);
		s = { ...s, offer: ['godfather'] };
		s = takeOffer(s, 'godfather', random);
		expect(s.slots).toEqual({ townsfolk: 5, outsider: 1, minion: 0, demon: 1 });
		expect(s.offer.length).toBeGreaterThan(0);
	});
});
