/**
 * The Sushi Buffet draft: offers of 3 → 2 → 1, keep one, the rest discarded or recycled;
 * setup modifiers apply as drafted. https://grimbits.com/draft-buffet/
 */
import { describe, expect, it } from 'vitest';
import type { Character } from '#lib/core/data/types.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { baseCounts } from '#lib/core/rules/distribution.ts';
import {
	canRedraft,
	conversions,
	draftedTurned,
	canRefuse,
	redraft,
	refuseOffer,
	reservedHidden,
	reservedSeats,
	seatsLeft,
	answerAbility,
	answerAsk,
	answerHidden,
	draftTotal,
	startDraft,
	takeOffer,
	turnOffer,
	type DraftConfig
} from './draft.ts';
import { SUSHI_BUFFET } from './library/sushi-buffet.ts';
import { hiddenAsTownsfolk, pickableCharacters } from './pool.ts';

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

	it('go straight from three to one with a single mulligan (Grimbits’ 3 → 1)', () => {
		const random = seeded();
		let s = startDraft({ ...config, offers: [3, 1] }, baseCounts(7), tb, random);
		expect(s.offer).toHaveLength(3);
		s = refuseOffer(s, random);
		expect(s.offer).toHaveLength(1);
		expect(canRefuse(s)).toBe(false);
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

	it('deals nothing with the Storyteller’s switch off (Grimbits’ “Don’t force a King”)', () => {
		const random = seeded(2);
		const s = startDraft(
			{ ...config, modifiers: true, dealsRequired: false },
			baseCounts(7),
			tb.concat(data.characters.filter((c) => c.id === 'choirboy' || c.id === 'king')),
			random
		);
		expect(s.requires).toBeUndefined();
	});

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

// The Drunk thinks they are a Townsfolk (https://wiki.bloodontheclocktower.com/Drunk), so the
// Storyteller picks a drafted Townsfolk to be it; the Marionette is a Minion, so not here.
describe('characters hidden as a drafted Townsfolk', () => {
	it('are the Drunk among official characters', () => {
		expect(hiddenAsTownsfolk(data.characters).map((c) => c.id)).toEqual(['drunk']);
		expect(pickableCharacters(SUSHI_BUFFET, data.characters).map((c) => c.id)).not.toContain(
			'drunk'
		);
	});
});

// Ivory draft, as Grimbits' tool offers: at most one character that can make an extra evil
// player, the kind the Spirit of Ivory limits (https://wiki.bloodontheclocktower.com/Spirit_of_Ivory).
describe('Ivory draft', () => {
	const pick = (...ids: string[]) => ids.map((id) => data.byId.get(id)!);
	const counts = { townsfolk: 2, outsider: 1, minion: 0, demon: 0 };
	const afterGoon = (ivory: boolean, pool = pick('bountyhunter', 'cultleader', 'chef')) => {
		const random = seeded(5);
		const s = startDraft(
			{ ...config, offers: [3, 2, 1], ivory },
			counts,
			[...pick('goon'), ...pool],
			random
		);
		return takeOffer({ ...s, offer: ['goon'] }, 'goon', random);
	};

	it('marks the characters that make an extra evil player', () => {
		const marked = data.characters.filter((c) => rulesOf(c.id)?.makesExtraEvil).map((c) => c.id);
		expect(marked.sort()).toEqual(
			[
				'bountyhunter',
				'cultleader',
				'fanggu',
				'goon',
				'legion',
				'lordoftyphon',
				'mezepheles',
				'ogre',
				'politician'
			].sort()
		);
	});

	it('offers no other once one is drafted', () => {
		expect(afterGoon(true).offer).toEqual(['chef']);
		expect(afterGoon(false).offer).toHaveLength(3);
	});

	it('still offers one when nothing else fills the seat', () => {
		expect(afterGoon(true, pick('bountyhunter')).offer).toEqual(['bountyhunter']);
	});
});

// Grimbits' Redraft: the Storyteller lets the last player draft again, optionally of one type.
describe('redraft', () => {
	it('goes back to before the last pick, sets the kept character aside and offers anew', () => {
		const random = seeded(3);
		const start = startDraft(config, baseCounts(7), tb, random);
		const kept = start.offer[0];
		const s = takeOffer(start, kept, random);
		expect(canRedraft(s)).toBe(true);
		const again = redraft(s, undefined, random);
		expect(again.picks).toEqual([]);
		expect(again.slots).toEqual(start.slots);
		expect(again.discarded).toContain(kept);
		expect(again.offer).toHaveLength(3);
		expect(again.offer).not.toContain(kept);
		expect(canRedraft(again)).toBe(false);
	});

	it('undoes a setup change the kept character made (the Baron’s +2 Outsiders)', () => {
		const random = seeded(4);
		const start = startDraft({ ...config, modifiers: true }, baseCounts(7), tb, random);
		const s = takeOffer({ ...start, offer: ['baron'] }, 'baron', random);
		expect(draftTotal(s, 'outsider')).toBe(2);
		expect(draftTotal(redraft(s, undefined, random), 'outsider')).toBe(0);
	});

	it('offers only the named type, on refusals too', () => {
		const random = seeded(5);
		const start = startDraft(config, baseCounts(7), tb, random);
		let s = redraft(takeOffer(start, start.offer[0], random), 'minion', random);
		const typeOf = (id: string) => data.byId.get(id)?.type;
		expect(s.offer.every((id) => typeOf(id) === 'minion')).toBe(true);
		s = refuseOffer(s, random);
		expect(s.offer.every((id) => typeOf(id) === 'minion')).toBe(true);
		const next = takeOffer(s, s.offer[0], random);
		expect(next.onlyType).toBeUndefined();
	});
});

// Grimbits lets the Storyteller reject a drafted Legion: the player picks again
// (https://grimbits.com/draft-buffet/, https://wiki.bloodontheclocktower.com/Legion).
describe('rejecting a drafted character whose setup change is asked', () => {
	it('drafts again from before the pick, with nothing left to ask', () => {
		const random = seeded(6);
		const start = startDraft(
			{ ...config, modifiers: true },
			baseCounts(7),
			tb.concat(data.characters.filter((c) => c.id === 'legion')),
			random
		);
		const s = takeOffer({ ...start, offer: ['legion'] }, 'legion', random);
		expect(s.ask).toBeDefined();
		const again = redraft(s, undefined, random);
		expect(again.ask).toBeUndefined();
		expect(again.picks).toEqual([]);
		expect(again.slots).toEqual(start.slots);
		expect(again.offer).not.toContain('legion');
	});
});

// Grimbits' draft (https://grimbits.com/draft-buffet/): a drafted Atheist may really be the
// Drunk, who thinks they are a Townsfolk (https://wiki.bloodontheclocktower.com/Drunk), or
// a real Atheist, whose game has no evil characters (https://wiki.bloodontheclocktower.com/Atheist).
describe('a drafted character that may really be a hidden one', () => {
	const atheist = data.characters.filter((c) => c.id === 'atheist');
	const start = (hidden: string[] = ['drunk']) =>
		startDraft(
			{ ...config, modifiers: true, hidden },
			baseCounts(7),
			tb.concat(atheist),
			seeded(3)
		);

	it('is named by its rules file', () => {
		expect(rulesOf('atheist')?.orHiddenAs).toBe('drunk');
		expect(start().orHidden).toEqual({ atheist: 'drunk' });
		expect(start([]).orHidden).toBeUndefined();
	});

	it('asks the Storyteller before its setup change, with no offer meanwhile', () => {
		const s = takeOffer({ ...start(), offer: ['atheist'] }, 'atheist', seeded(3));
		expect(s.choice).toEqual({ characterId: 'atheist', hidden: 'drunk' });
		expect(s.offer).toEqual([]);
		expect(s.ask).toBeUndefined();
		expect(canRedraft(s)).toBe(true);
	});

	it('as the Drunk: marks the seat and keeps the evil seats', () => {
		const first = start();
		const s = answerHidden(
			takeOffer({ ...first, offer: ['atheist'] }, 'atheist', seeded(3)),
			true,
			seeded(3)
		);
		expect(s.choice).toBeUndefined();
		expect(s.hiddenSeats).toEqual({ 0: 'drunk' });
		expect(s.slots.minion).toBe(first.slots.minion);
		expect(s.slots.demon).toBe(first.slots.demon);
		expect(s.offer.length).toBeGreaterThan(0);
	});

	it('as the Atheist: takes out every evil seat, then asks the Outsiders', () => {
		const s = answerHidden(
			takeOffer({ ...start(), offer: ['atheist'] }, 'atheist', seeded(3)),
			false,
			seeded(3)
		);
		expect(s.hiddenSeats).toBeUndefined();
		expect(draftTotal(s, 'minion')).toBe(0);
		expect(draftTotal(s, 'demon')).toBe(0);
		expect(s.ask?.type).toBe('outsider');
	});
});

// Grimbits' draft (https://grimbits.com/draft-buffet/): a drafted Alchemist may take a Minion
// ability now when it changes setup, or later. The Alchemist has a not-in-play Minion ability
// (https://wiki.bloodontheclocktower.com/Alchemist), so the Baron's +2 Outsiders apply
// (https://wiki.bloodontheclocktower.com/Baron).
describe('a drafted character that gains another character’s ability', () => {
	const alchemist = data.characters.filter((c) => c.id === 'alchemist');
	const start = () =>
		startDraft({ ...config, modifiers: true }, baseCounts(7), tb.concat(alchemist), seeded(4));
	const kept = () => takeOffer({ ...start(), offer: ['alchemist'] }, 'alchemist', seeded(4));

	it('is named by its rules file', () => {
		expect(rulesOf('alchemist')?.gainsAbilityOf).toBe('minion');
		expect(start().gains).toEqual({ alchemist: 'minion' });
	});

	it('asks which Minion ability, among those that change setup, with no offer meanwhile', () => {
		const s = kept();
		expect(s.ability?.characterId).toBe('alchemist');
		expect(s.ability?.options).toContain('baron');
		expect(s.ability?.options).not.toContain('poisoner');
		expect(s.offer).toEqual([]);
	});

	it('applies the chosen ability’s setup change and keeps that Minion out of play', () => {
		const before = kept();
		const s = answerAbility(before, 'baron', seeded(4));
		expect(s.ability).toBeUndefined();
		expect(s.abilities).toEqual({ 0: 'baron' });
		expect(s.pool).not.toContain('baron');
		expect(draftTotal(s, 'outsider')).toBe(draftTotal(before, 'outsider') + 2);
		expect(s.offer.length).toBeGreaterThan(0);
	});

	it('changes nothing now when the ability is chosen later', () => {
		const before = kept();
		const s = answerAbility(before, undefined, seeded(4));
		expect(s.abilities).toBeUndefined();
		expect(s.slots).toEqual(before.slots);
		expect(s.pool).toContain('baron');
	});
});

// Grimbits' draft (https://grimbits.com/draft-buffet/): the Marionette keeps a Minion seat out of
// the draft and one more Townsfolk is drafted; the Marionette is a good player next to the Demon
// (https://wiki.bloodontheclocktower.com/Marionette).
describe('a reserved hidden character', () => {
	const marionette = () => reservedHidden(data.characters).find((r) => r.id === 'marionette')!;

	it('is found from its token’s target rule', () => {
		expect(marionette()).toEqual({ id: 'marionette', type: 'minion', nextTo: 'demon' });
		expect(reservedHidden(data.characters).map((r) => r.id)).not.toContain('drunk');
	});

	it('keeps a Minion seat out of the draft for one more Townsfolk', () => {
		const counts = baseCounts(7);
		const s = startDraft({ ...config, reserve: marionette() }, counts, tb, seeded(5));
		expect(s.reserved).toBe(true);
		expect(s.slots.minion).toBe(counts.minion - 1);
		expect(s.slots.townsfolk).toBe(counts.townsfolk + 1);
	});

	it('may be the nearest good player each way from the Demon, skipping evil ones', () => {
		const s = {
			...startDraft(config, baseCounts(5), tb, seeded(5)),
			picks: ['chef', 'poisoner', 'imp', 'empath', 'saint']
		};
		expect(reservedSeats(s, marionette())).toEqual([0, 3]);
		expect(reservedSeats(s, marionette(), [0])).toEqual([3]);
	});
});

// Grimbits' draft (https://grimbits.com/draft-buffet/): no Minions are drafted with a Kazali,
// which then picks which players are which Minions
// (https://wiki.bloodontheclocktower.com/Kazali).
describe('a drafted character that turns players into another type', () => {
	const kazali = data.characters.filter((c) => c.id === 'kazali');
	const start = () =>
		startDraft({ ...config, modifiers: true }, baseCounts(7), tb.concat(kazali), seeded(6));

	it('is named by its rules file, with the type’s usual count', () => {
		expect(rulesOf('kazali')?.turnsPlayersInto).toEqual({ type: 'minion', players: 'chosen' });
		expect(start().turns).toEqual({
			kazali: { type: 'minion', players: 'chosen', usual: baseCounts(7).minion }
		});
	});

	it('turns as many players as the usual Minion count once drafted', () => {
		const s = { ...start(), picks: ['chef', 'kazali', 'empath'] };
		expect(conversions(s)).toEqual([
			{ characterId: 'kazali', seat: 1, type: 'minion', players: 'chosen', count: 1 }
		]);
	});

	it('turns fewer players for each Minion already drafted, and none when undrafted', () => {
		expect(conversions({ ...start(), picks: ['poisoner', 'kazali'] })).toEqual([]);
		expect(conversions({ ...start(), picks: ['chef'] })).toEqual([]);
	});

	it('is not counted without setup changes', () => {
		const s = startDraft(config, baseCounts(7), tb.concat(kazali), seeded(6));
		expect(conversions({ ...s, picks: ['kazali'] })).toEqual([]);
	});
});

describe('a conversion beside a reserved hidden character', () => {
	it('turns one fewer player when the reserved character is of the type (the Marionette)', () => {
		const reserve = reservedHidden(data.characters).find((r) => r.id === 'marionette')!;
		const kazali = data.characters.filter((c) => c.id === 'kazali');
		const s = startDraft(
			{ ...config, modifiers: true, reserve },
			baseCounts(7),
			tb.concat(kazali),
			seeded(6)
		);
		expect(conversions({ ...s, picks: ['kazali'] })).toEqual([]);
	});
});

// Grimbits' draft (https://grimbits.com/draft-buffet/): the Lord of Typhon's neighbours become
// Minions, so the evil players sit in a line with it in the middle
// (https://wiki.bloodontheclocktower.com/Lord_of_Typhon).
describe('a drafted character whose neighbours turn into another type', () => {
	const typhon = data.characters.filter((c) => c.id === 'lordoftyphon');
	const start = () =>
		startDraft({ ...config, modifiers: true }, baseCounts(7), tb.concat(typhon), seeded(7));
	// Every seat drafted.
	const none = { townsfolk: 0, outsider: 0, minion: 0, demon: 0 };

	it('is named by its rules file', () => {
		expect(rulesOf('lordoftyphon')?.turnsPlayersInto).toEqual({
			type: 'minion',
			players: 'neighbours'
		});
	});

	it('keeps its +1 Minion and both neighbours’ seats out of the draft', () => {
		const before = start();
		let s = takeOffer({ ...before, offer: ['lordoftyphon'] }, 'lordoftyphon', seeded(7));
		// Its Outsiders are asked: keep them.
		if (s.ask) s = answerAsk(s, s.ask.current, seeded(7));
		expect(s.slots.minion).toBe(0);
		expect(draftTotal(s, 'townsfolk')).toBe(draftTotal(before, 'townsfolk') + 1);
	});

	it('turns its two neighbours, but not one that drafted a Minion', () => {
		const s = start();
		const picks = ['chef', 'lordoftyphon', 'empath', 'monk', 'saint', 'butler', 'washerwoman'];
		expect(conversions({ ...s, picks, slots: none })).toEqual([
			{
				characterId: 'lordoftyphon',
				seat: 1,
				type: 'minion',
				players: 'neighbours',
				count: 2,
				seats: [0, 2]
			}
		]);
		const both = ['poisoner', 'lordoftyphon', 'empath', 'monk', 'saint', 'butler', 'chef'];
		const done = { ...s, picks: both, slots: none };
		expect(conversions(done)[0].seats).toEqual([2]);
	});

	it('wraps round: the last seat’s neighbour is the first', () => {
		const s = start();
		const picks = ['chef', 'empath', 'monk', 'saint', 'butler', 'washerwoman', 'lordoftyphon'];
		const done = { ...s, picks, slots: none };
		expect(conversions(done)[0].seats).toEqual([0, 5]);
	});

	// Trevor, 2026-10-27: the neighbours pick their Minion through the offers.
	it('offers each neighbour Minions, leaving out those refused until all are', () => {
		const minions = ['poisoner', 'spy', 'baron', 'scarletwoman'];
		const first = turnOffer(minions, [], 3, seeded(9));
		expect(first).toHaveLength(3);
		expect(new Set(first).size).toBe(3);
		expect(first.every((id) => minions.includes(id))).toBe(true);
		expect(turnOffer(minions, first, 3, seeded(9))).toEqual(
			minions.filter((id) => !first.includes(id))
		);
		expect(turnOffer(minions, minions, 2, seeded(9))).toHaveLength(2);
	});
});

// Grimbits' draft (https://grimbits.com/draft-buffet/): Lil' Monsta is never dealt, so its player
// becomes a Minion and picks their Minion (https://wiki.bloodontheclocktower.com/Lil%27_Monsta).
describe('a drafted character that turns its own player into another type', () => {
	const monsta = data.characters.filter((c) => c.id === 'lilmonsta');
	const start = () =>
		startDraft({ ...config, modifiers: true }, baseCounts(7), tb.concat(monsta), seeded(8));

	it('is named by its rules file, and offered by a draft though never dealt', () => {
		expect(rulesOf('lilmonsta')?.turnsPlayersInto).toEqual({ type: 'minion', players: 'drafter' });
		expect(draftedTurned(data.characters).map((c) => c.id)).toEqual(['lilmonsta']);
	});

	it('leaves no Demon seat, adds a Minion and offers the same seat only Minions', () => {
		const before = start();
		const s = takeOffer({ ...before, offer: ['lilmonsta'] }, 'lilmonsta', seeded(8));
		expect(s.picks).toEqual([]);
		expect(s.undealt).toEqual(['lilmonsta']);
		expect(s.turnedBy).toBe('lilmonsta');
		expect(s.slots.demon).toBe(0);
		expect(s.slots.minion).toBe(before.slots.minion + 1);
		// The Demon's seat is the extra Minion's: as many good seats as before.
		expect(s.slots.townsfolk + s.slots.outsider).toBe(
			before.slots.townsfolk + before.slots.outsider
		);
		expect(s.offer.length).toBeGreaterThan(0);
		expect(s.offer.every((id) => s.types[id] === 'minion')).toBe(true);
		const next = takeOffer(s, s.offer[0], seeded(8));
		expect(next.picks).toEqual([s.offer[0]]);
		expect(next.turnedBy).toBeUndefined();
	});
});
