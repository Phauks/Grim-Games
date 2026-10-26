/**
 * The Sushi Buffet draft: offers of 3 → 2 → 1, keep one, the rest discarded or recycled;
 * setup modifiers apply as drafted. https://grimbits.com/draft-buffet/
 */
import { describe, expect, it } from 'vitest';
import type { Character } from '#lib/core/data/types.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { baseCounts } from '#lib/core/rules/distribution.ts';
import {
	canRefuse,
	refuseOffer,
	seatsLeft,
	answerAsk,
	draftTotal,
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
	// Without the mode's `as-chosen` modifiers, counts never change (Trevor, 2026-10-19).
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

// Trevor, 2026-10-26: "modifiers are made dynamically for outsider count", as Grimbits' draft
// does (https://grimbits.com/draft-buffet/).
describe('setup modifiers as drafted', () => {
	const live: DraftConfig = { ...config, modifiers: true };
	const bmr = data.characters.filter((c) => c.edition === 'bmr');
	const snv = data.characters.filter((c) => c.edition === 'snv');
	const all = data.characters;
	const draft = (pool: readonly Character[] = tb, players = 8) =>
		startDraft(live, baseCounts(players), pool, seeded());
	const take = (s: ReturnType<typeof draft>, id: string) =>
		takeOffer({ ...s, offer: [id] }, id, seeded());

	it('a drafted Baron adds two Outsiders at once (https://wiki.bloodontheclocktower.com/Baron)', () => {
		const s = take(draft(), 'baron');
		expect(s.slots).toEqual({ townsfolk: 3, outsider: 3, minion: 0, demon: 1 });
		expect(s.ask).toBeUndefined();
		expect(s.offer.length).toBeGreaterThan(0);
	});

	it('a Fang Gu adds one Outsider and a Vigormortis removes one (https://wiki.bloodontheclocktower.com/Fang_Gu, /Vigormortis)', () => {
		expect(take(draft(snv), 'fanggu').slots).toMatchObject({ townsfolk: 4, outsider: 2 });
		expect(take(draft(snv), 'vigormortis').slots).toMatchObject({ townsfolk: 6, outsider: 0 });
	});

	it('asks the Storyteller for the Godfather’s −1 or +1, with no offer until then (https://wiki.bloodontheclocktower.com/Godfather)', () => {
		const s = take(draft(bmr), 'godfather');
		expect(s.ask).toEqual({
			characterId: 'godfather',
			type: 'outsider',
			options: [0, 2],
			current: 1
		});
		expect(s.offer).toEqual([]);
		const answered = answerAsk(s, 2, seeded());
		expect(answered.slots).toMatchObject({ townsfolk: 4, outsider: 2 });
		expect(answered.ask).toBeUndefined();
		expect(answered.offer.length).toBeGreaterThan(0);
		// A count that isn't one of the options changes nothing.
		expect(answerAsk(s, 5, seeded())).toBe(s);
	});

	it('lets the Xaan set any number of Outsiders the open seats allow (https://wiki.bloodontheclocktower.com/Xaan)', () => {
		const s = take(draft(all), 'xaan');
		expect(s.ask).toMatchObject({ type: 'outsider', options: [0, 1, 2, 3, 4, 5, 6], current: 1 });
		const set = answerAsk(s, 3, seeded());
		expect(draftTotal(set, 'outsider')).toBe(3);
		// After that, a Baron's +2 is asked: apply it, or keep the count set.
		const baron = take(set, 'baron');
		expect(baron.ask).toMatchObject({ characterId: 'baron', options: [5], current: 3 });
		expect(draftTotal(answerAsk(baron, 3, seeded()), 'outsider')).toBe(3);
	});

	it('never removes a seat already drafted: a Vigormortis after the only Outsider leaves it', () => {
		let s = take(draft(snv), 'mutant');
		s = take(s, 'vigormortis');
		expect(draftTotal(s, 'outsider')).toBe(1);
		expect(s.slots.outsider).toBe(0);
	});

	it('an Atheist takes out the evil seats still open (https://wiki.bloodontheclocktower.com/Atheist)', () => {
		const s = take(draft(all), 'atheist');
		expect(s.slots).toMatchObject({ minion: 0, demon: 0 });
		expect(s.ask).toMatchObject({ characterId: 'atheist', type: 'outsider' });
	});
});

// Grimbits' draft forces the character another needs (https://grimbits.com/draft-buffet/).
describe('characters another needs in play', () => {
	const live: DraftConfig = { ...config, modifiers: true };
	const all = data.characters;
	const take = (s: ReturnType<typeof startDraft>, id: string) =>
		takeOffer({ ...s, offer: [id] }, id, seeded());

	it('deals the King to the next seat after a Choirboy, with no refusing (https://wiki.bloodontheclocktower.com/Choirboy)', () => {
		const s = take(startDraft(live, baseCounts(8), all, seeded()), 'choirboy');
		expect(s.offer).toEqual(['king']);
		expect(s.forcedBy).toBe('choirboy');
		expect(canRefuse(s)).toBe(false);
		expect(s.pool).not.toContain('king');
		const next = takeOffer(s, 'king', seeded());
		expect(next.picks).toEqual(['choirboy', 'king']);
		expect(next.forcedBy).toBeUndefined();
		expect(next.offer).toHaveLength(3);
	});

	it('makes room for the Damsel in a Townsfolk seat after a Huntsman (https://wiki.bloodontheclocktower.com/Huntsman)', () => {
		let s = startDraft(live, baseCounts(8), all, seeded());
		s = take(s, 'mutant');
		// The one Outsider seat is drafted, so the Damsel takes a Townsfolk seat.
		s = take(s, 'huntsman');
		expect(s.offer).toEqual(['damsel']);
		expect(s.slots).toMatchObject({ townsfolk: 3, outsider: 1 });
	});

	it('forces nothing when the King is already drafted, or without the mode’s modifiers', () => {
		let s = take(startDraft(live, baseCounts(8), all, seeded()), 'king');
		s = take(s, 'choirboy');
		expect(s.forcedBy).toBeUndefined();
		const off = take(startDraft(config, baseCounts(8), all, seeded()), 'choirboy');
		expect(off.forcedBy).toBeUndefined();
	});
});

/**
 * Jinxed pairs, as Grimbits' tool's option: blocked, less likely, or allowed. The Heretic and
 * the Baron are jinxed so that only one can be in play
 * (https://wiki.bloodontheclocktower.com/Heretic#Related_Jinxes).
 */
describe('jinxed pairs', () => {
	const pick = (...ids: string[]) => ids.map((id) => data.byId.get(id)!);
	const jinxes = data.jinxes.all;
	const counts = { townsfolk: 0, outsider: 1, minion: 1, demon: 0 };
	const afterHeretic = (jinxed: DraftConfig['jinxes'], seed: number, offers = [3, 2, 1]) => {
		const random = seeded(seed);
		const s = startDraft(
			{ ...config, offers, jinxes: jinxed },
			counts,
			pick('heretic', 'baron', 'poisoner'),
			random,
			jinxes
		);
		// The Heretic's seat drafts first, so nothing else is set aside.
		return takeOffer({ ...s, offer: ['heretic'] }, 'heretic', random);
	};

	it('block a character jinxed with one drafted', () => {
		for (let seed = 1; seed < 20; seed++)
			expect(afterHeretic('block', seed).offer).toEqual(['poisoner']);
	});

	it('still offer a blocked character when nothing else fills the seat', () => {
		const random = seeded(3);
		const s = startDraft(
			{ ...config, jinxes: 'block' },
			counts,
			pick('heretic', 'baron'),
			random,
			jinxes
		);
		expect(takeOffer(s, 'heretic', random).offer).toEqual(['baron']);
	});

	it('make a jinxed character half as likely with reduce, and leave it alone with allow', () => {
		const rate = (jinxed: DraftConfig['jinxes']) => {
			let n = 0;
			for (let seed = 1; seed <= 2000; seed++)
				if (afterHeretic(jinxed, seed, [1, 1, 1]).offer[0] === 'baron') n++;
			return n / 2000;
		};
		expect(rate('reduce')).toBeCloseTo(1 / 3, 1);
		expect(rate('allow')).toBeCloseTo(1 / 2, 1);
		expect(rate(undefined)).toBeCloseTo(1 / 2, 1);
	});
});
