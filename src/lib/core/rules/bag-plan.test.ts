import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import {
	newGame,
	run,
	testCharacters,
	testContext
} from '#lib/core/model/fixtures.test-support.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import { placeableSetupReminders, setupReminders } from './setup-reminders.ts';
import {
	analyseSelection,
	bagSlots,
	nextDrawSeat,
	planBag,
	randomSelection,
	selectedIds,
	selectionProblems,
	validRandomSelection,
	type BagSelection
} from './bag-plan.ts';
import { scriptFacts } from './script-facts.ts';

const data = committedGameData();
const lookup = (id: string) => data.byId.get(id);
const script = (ids: string[]) => ids.map((id) => data.byId.get(id)!);

const TB = script([
	'washerwoman',
	'librarian',
	'investigator',
	'chef',
	'empath',
	'fortuneteller',
	'undertaker',
	'monk',
	'ravenkeeper',
	'virgin',
	'slayer',
	'soldier',
	'mayor',
	'butler',
	'drunk',
	'recluse',
	'saint',
	'poisoner',
	'spy',
	'scarletwoman',
	'baron',
	'imp'
]);
const pick = (...ids: string[]): BagSelection => Object.fromEntries(ids.map((id) => [id, 1]));
const plan = (selection: BagSelection, extra: Partial<Parameters<typeof planBag>[0]> = {}) =>
	planBag({ selection, scriptCharacters: TB, lookup, ...extra });

/** A fixed sequence of random numbers, repeating. */
const sequence =
	(...values: number[]) =>
	() => {
		const v = values.shift()!;
		values.push(v);
		return v;
	};

describe('planBag', () => {
	it('puts one tile per selected character, showing itself', () => {
		const result = plan(pick('chef', 'empath', 'monk', 'poisoner', 'imp'));
		expect(result.tiles).toEqual([
			{ shows: 'chef', grimoire: 'chef' },
			{ shows: 'empath', grimoire: 'empath' },
			{ shows: 'monk', grimoire: 'monk' },
			{ shows: 'poisoner', grimoire: 'poisoner' },
			{ shows: 'imp', grimoire: 'imp' }
		]);
		expect(result.issues).toEqual([]);
		expect(result.includeTravellers).toBe(false);
	});

	// https://wiki.bloodontheclocktower.com/Drunk: the Drunk's token is never in the bag; the
	// Drunk's player holds a Townsfolk token. The Storyteller adds that Townsfolk like any
	// other and decides who is the Drunk after the draw (Trevor, 2026-10-16).
	it('Drunk: no tile of its own, and "Is The Drunk" waits for the draw', () => {
		const result = plan(pick('chef', 'empath', 'monk', 'drunk', 'poisoner', 'imp'));
		expect(result.tiles.map((t) => t.grimoire)).toEqual([
			'chef',
			'empath',
			'monk',
			'poisoner',
			'imp'
		]);
		expect(result.tiles.every((t) => t.shows === t.grimoire)).toBe(true);
		expect(result.unseated).toEqual([{ characterId: 'drunk', label: 'Is The Drunk' }]);
		expect(result.standIns).toEqual([]);
		expect(result.issues).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Philosopher: the Philosopher's own token is in the
	// bag; "Is The Philosopher" only matters once they gain an ability, so nothing waits on it.
	it('Philosopher: an ordinary tile, and no "Is The …" token waits for the draw', () => {
		const result = planBag({
			selection: pick('philosopher', 'imp'),
			scriptCharacters: script(['philosopher', 'chef', 'imp']),
			lookup
		});
		expect(result.tiles).toEqual([
			{ shows: 'philosopher', grimoire: 'philosopher' },
			{ shows: 'imp', grimoire: 'imp' }
		]);
		expect(result.unseated).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Marionette: the Marionette thinks they are a good
	// character and neighbours the Demon; their token is not in the bag.
	it('Marionette: no tile of its own, and "Is The Marionette" waits for the draw', () => {
		const result = planBag({
			selection: pick('chef', 'saint', 'marionette', 'imp'),
			scriptCharacters: script(['chef', 'empath', 'saint', 'marionette', 'imp']),
			lookup
		});
		expect(result.tiles.map((t) => t.grimoire)).toEqual(['chef', 'saint', 'imp']);
		expect(result.unseated).toEqual([{ characterId: 'marionette', label: 'Is The Marionette' }]);
	});

	// https://wiki.bloodontheclocktower.com/Lunatic: the Lunatic is shown a Demon token.
	it('Lunatic: shown the Demon in play, with the Lunatic in the grimoire', () => {
		const result = planBag({
			selection: pick('lunatic', 'nodashii'),
			scriptCharacters: script(['chef', 'lunatic', 'imp', 'nodashii']),
			lookup
		});
		expect(result.tiles[0]).toEqual({ shows: 'nodashii', grimoire: 'lunatic' });
		expect(result.standIns[0]).toMatchObject({ kind: 'demon', options: ['imp', 'nodashii'] });
	});

	// https://wiki.bloodontheclocktower.com/Lil%27_Monsta: no Demon is dealt.
	it("Lil' Monsta: no tile, and an issue says so", () => {
		const result = planBag({
			selection: pick('chef', 'poisoner', 'lilmonsta'),
			scriptCharacters: script(['chef', 'poisoner', 'lilmonsta']),
			lookup
		});
		expect(result.tiles.map((t) => t.shows)).toEqual(['chef', 'poisoner']);
		expect(result.issues.map((i) => i.code)).toEqual(['not-dealt']);
	});

	it('Fabled and Loric never go in the bag; Travellers set includeTravellers', () => {
		const result = planBag({
			selection: pick('chef', 'gunslinger', 'sentinel'),
			scriptCharacters: script(['chef', 'gunslinger', 'sentinel']),
			lookup
		});
		expect(result.tiles.map((t) => t.shows)).toEqual(['chef', 'gunslinger']);
		expect(result.includeTravellers).toBe(true);
		expect(result.issues.map((i) => i.code)).toEqual(['rule-character']);
	});

	// https://wiki.bloodontheclocktower.com/Village_Idiot: up to two extra Village Idiots.
	it('copies are separate tiles', () => {
		expect(selectedIds({ villageidiot: 3, chef: 1 }, ['chef', 'villageidiot'])).toEqual([
			'chef',
			'villageidiot',
			'villageidiot',
			'villageidiot'
		]);
	});
});

describe('analyseSelection', () => {
	const analyse = (players: number, selection: BagSelection, order = TB.map((c) => c.id)) =>
		analyseSelection({ players, selection, scriptOrder: order, lookup });

	it('counts the selection against the setup sheet', () => {
		const result = analyse(5, pick('chef', 'empath', 'monk', 'poisoner', 'imp'));
		expect(result.chosen).toEqual({ townsfolk: 3, outsider: 0, minion: 1, demon: 1 });
		expect(result.warnings).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Lil%27_Monsta
	it("Lil' Monsta changes the counts without being counted", () => {
		const result = analyse(
			8,
			pick('chef', 'empath', 'monk', 'soldier', 'mayor', 'saint', 'poisoner', 'spy', 'lilmonsta'),
			[...TB.map((c) => c.id), 'lilmonsta']
		);
		expect(result.chosen.demon).toBe(0);
		expect(result.warnings).toEqual([]);
	});

	it('selected Travellers are not dealt', () => {
		const result = analyse(7, pick('chef', 'empath', 'monk', 'poisoner', 'imp', 'gunslinger'));
		expect(result.dealt).toBe(6);
		expect(result.travellers).toBe(1);
	});
});

describe('randomSelection', () => {
	const fill = (players: number, selection: BagSelection = {}, random = sequence(0.1, 0.7, 0.4)) =>
		randomSelection({
			players,
			selection,
			scriptCharacters: TB,
			scriptOrder: TB.map((c) => c.id),
			lookup,
			random
		});

	it.each([5, 7, 8, 10, 12, 15])('fills %i players to the setup sheet', (players) => {
		const selection = fill(players);
		const result = analyseSelection({
			players,
			selection,
			scriptOrder: TB.map((c) => c.id),
			lookup
		});
		expect(result.warnings).toEqual([]);
	});

	it('keeps what was already selected', () => {
		const selection = fill(9, pick('baron', 'virgin'));
		expect(selection.baron).toBe(1);
		expect(selection.virgin).toBe(1);
		// https://wiki.bloodontheclocktower.com/Baron: +2 Outsiders.
		const result = analyseSelection({
			players: 9,
			selection,
			scriptOrder: TB.map((c) => c.id),
			lookup
		});
		expect(result.chosen.outsider).toBe(4);
		expect(result.warnings).toEqual([]);
	});

	it('fills players beyond 15 with Travellers from the script', () => {
		const withTravellers = [...TB, ...script(['gunslinger', 'beggar', 'thief'])];
		const selection = randomSelection({
			players: 17,
			selection: {},
			scriptCharacters: withTravellers,
			scriptOrder: withTravellers.map((c) => c.id),
			lookup,
			random: sequence(0.3, 0.6)
		});
		const travellers = Object.keys(selection).filter((id) => lookup(id)?.type === 'traveller');
		expect(travellers).toHaveLength(2);
	});
});

describe('the draw', () => {
	// A 5-player Trouble Brewing-style bag with a Drunk, built with BuildBag.
	function drawGame() {
		const { session, ctx, seats } = newGame(5, { ctx: testContext({ seed: 7 }) });
		const bag = plan(pick('chef', 'empath', 'monk', 'drunk', 'poisoner', 'imp'));
		const built = run(session, ctx, {
			type: 'BuildBag',
			tiles: bag.tiles,
			includeTravellers: bag.includeTravellers,
			unseated: bag.unseated
		});
		return { session: built, ctx, seats };
	}

	it('draws go to empty seats in seating order', () => {
		const { session, ctx, seats } = drawGame();
		expect(nextDrawSeat(session.game)).toBe(seats[0]);
		const held = run(session, ctx, { type: 'DrawTile', seatId: seats[0] });
		// A seat holding a tile is skipped until the draw is confirmed or put back.
		expect(nextDrawSeat(held.game)).toBe(seats[1]);
	});

	it('numbers every tile once and keeps the numbers through the draw', () => {
		const { session, ctx, seats } = drawGame();
		const before = bagSlots(session.game.bag!);
		expect(before.map((s) => s.number)).toEqual([1, 2, 3, 4, 5]);
		const tileId = before[2].tileId;
		const held = run(session, ctx, { type: 'DrawTile', seatId: seats[0], tileId });
		const after = bagSlots(held.game.bag!);
		expect(after.map((s) => s.tileId)).toEqual(before.map((s) => s.tileId));
		expect(after[2]).toEqual({ tileId, number: 3, state: 'held', seatId: seats[0] });
		const confirmed = run(held, ctx, { type: 'ConfirmDraw', tileId });
		expect(bagSlots(confirmed.game.bag!)[2].state).toBe('drawn');
	});

	// https://wiki.bloodontheclocktower.com/Drunk: the Drunk's player believes they are the
	// Townsfolk they hold; the grimoire records the truth once the Storyteller marks them.
	it('drawing every tile seats everyone, with the Drunk marked', () => {
		const { session: start, ctx } = drawGame();
		let session = start;
		for (let seat = nextDrawSeat(session.game); seat; seat = nextDrawSeat(session.game)) {
			session = run(session, ctx, { type: 'DrawTile', seatId: seat });
			const tileId = Object.values(session.game.bag!.tiles).find(
				(t) => t.drawnBySeat === seat
			)!.tileId;
			session = run(session, ctx, { type: 'ConfirmDraw', tileId });
		}
		// The Drunk's token is suggested for any Townsfolk; the Storyteller picks who.
		const suggested = setupReminders(session.game, testCharacters).filter(
			(r) => r.label === 'Is The Drunk'
		);
		expect(suggested).toHaveLength(1);
		expect(suggested[0].seatId).toBeUndefined();
		const townsfolk = session.game.seating.filter((id) =>
			['chef', 'empath', 'monk'].includes(session.game.seats[id].characterId!)
		);
		expect([...suggested[0].candidates].sort()).toEqual([...townsfolk].sort());
		expect(placeableSetupReminders(suggested)).toEqual([]);
		const empath = townsfolk.find((id) => session.game.seats[id].characterId === 'empath')!;
		session = run(session, ctx, {
			type: 'ApplySetupReminders',
			placements: [{ seatId: empath, reminder: { characterId: 'drunk', label: 'Is The Drunk' } }]
		});
		expect(
			setupReminders(session.game, testCharacters).some((r) => r.label === 'Is The Drunk')
		).toBe(false);
		const truths = session.game.seating.map((id) =>
			trueCharacter(session.game, id, testCharacters)
		);
		expect([...truths].sort()).toEqual(['chef', 'drunk', 'imp', 'monk', 'poisoner']);
		expect(session.game.bag!.order).toEqual([]);
	});
});

// Trevor, 2026-10-19: Random never lands on a selection the page would warn about, whatever
// the setup changes (https://wiki.bloodontheclocktower.com/Baron,
// https://wiki.bloodontheclocktower.com/Huntsman) or exclusive jinxes in play.
describe('validRandomSelection', () => {
	const editions = ['tb', 'bmr', 'snv'] as const;
	const seeded = (seed: number) => () => {
		seed = (seed * 1664525 + 1013904223) % 4294967296;
		return seed / 4294967296;
	};
	for (const edition of editions) {
		const characters = [...data.byId.values()].filter(
			(c) => c.edition === edition && c.type !== 'traveller'
		);
		const scriptOrder = characters.map((c) => c.id);
		const jinxes = scriptFacts(characters, data.jinxes).jinxes;
		it.each([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])(
			`${edition}: every random selection for %i players is valid`,
			(players) => {
				const random = seeded(players * 31 + edition.length);
				for (let i = 0; i < 60; i++) {
					const input = { players, scriptCharacters: characters, scriptOrder, lookup, jinxes };
					const result = validRandomSelection({ ...input, selection: {}, random });
					expect(result.ok).toBe(true);
					if (result.ok)
						expect(selectionProblems({ ...input, selection: result.selection })).toEqual([]);
				}
			}
		);
	}

	it('says why instead of choosing when nothing fits', () => {
		// Two Townsfolk and an Imp can't fill seven seats.
		const result = validRandomSelection({
			players: 7,
			selection: {},
			scriptCharacters: script(['washerwoman', 'chef', 'imp']),
			scriptOrder: ['washerwoman', 'chef', 'imp'],
			lookup,
			random: sequence(0.3),
			tries: 5
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.problems.length).toBeGreaterThan(0);
	});

	it('finds the Damsel for a Huntsman, or leaves the Huntsman out', () => {
		const characters = script([
			'huntsman',
			'chef',
			'empath',
			'monk',
			'soldier',
			'mayor',
			'damsel',
			'saint',
			'poisoner',
			'imp'
		]);
		const scriptOrder = characters.map((c) => c.id);
		for (let i = 0; i < 40; i++) {
			const result = validRandomSelection({
				players: 6,
				selection: {},
				scriptCharacters: characters,
				scriptOrder,
				lookup,
				random: seeded(i + 7)
			});
			expect(result.ok).toBe(true);
			if (result.ok && result.selection.huntsman) expect(result.selection.damsel).toBe(1);
		}
	});
});
