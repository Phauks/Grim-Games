/**
 * A whole Trouble Brewing game, night by night, through the engine (M42): the night order the
 * board walks, who wakes, what the info steps allow, which reminders come off on time, which
 * deaths happen, and how the game ends. Each character has its own tests; this finds what goes
 * wrong between them over a game (Trevor, 2026-11-03: "Whole-game run-throughs").
 *
 * Rules: https://wiki.bloodontheclocktower.com/Trouble_Brewing and each character's page.
 */
import { describe, expect, it } from 'vitest';
import { editionScript, toScript } from '#lib/core/data/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import {
	gameEnds,
	infoPicker,
	characterNominationPrompts,
	isAllowed,
	nightAnswer,
	preventedDeaths,
	starPass,
	type NightStep
} from '#lib/core/rules/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { boardNightSteps, stepHolders, stepWakes, tonight } from '../night-steps.ts';

const data = committedGameData();
const script = toScript(editionScript('tb', data)!);

// Eight players round the table: 5 Townsfolk, 1 Outsider, 1 Minion, 1 Demon (TB's setup sheet).
const cast = [
	'washerwoman',
	'empath',
	'imp',
	'fortuneteller',
	'poisoner',
	'monk',
	'butler',
	'ravenkeeper'
];

/** The steps that wake someone tonight, in order, as the board walks them. */
function wakes(s: Scenario, diedTonight: SeatId[] = []): string[] {
	const steps = boardNightSteps(s.game, s.characters, tonight(s.game), data);
	return steps
		.filter((step: NightStep) =>
			stepWakes(s.game, step, s.characters, { diedTonight: new Set(diedTonight) })
		)
		.map((step) => step.id);
}

function holders(s: Scenario, id: string): SeatId[] {
	const step = boardNightSteps(s.game, s.characters, tonight(s.game), data).find(
		(x) => x.id === id
	)!;
	return stepHolders(s.game, step, s.characters);
}

const labels = (s: Scenario, ref: string) =>
	s.game.seats[s.seat(ref)].reminders.map((r) => `${r.characterId}:${r.label}`);

describe('a Trouble Brewing game (M42)', () => {
	const setup = scenario(cast, { script }).reminder('monk', 'fortuneteller', 'Red Herring');

	// ── Night 1 ──
	const night1 = setup.reminder('empath', 'poisoner', 'Poisoned');

	it('night 1 wakes the evil team, then the Poisoner and the first-night info, in order', () => {
		expect(wakes(setup)).toEqual([
			'dusk',
			'minioninfo',
			'demoninfo',
			'poisoner',
			'washerwoman',
			'empath',
			'fortuneteller',
			'butler',
			'dawn'
		]);
		expect(holders(setup, 'minioninfo')).toEqual([setup.seat('poisoner')]);
		expect(holders(setup, 'demoninfo')).toEqual([setup.seat('imp')]);
	});

	it('night 1: the poisoned Empath may be told anything, the Washerwoman only the truth', () => {
		const empath = infoPicker(night1.game, night1.seat('empath'), 'empath', night1.characters)!;
		expect(empath.anyAllowed).toBe(true);
		const sober = infoPicker(setup.game, setup.seat('empath'), 'empath', setup.characters)!;
		// The Empath's neighbours are the Washerwoman and the Imp.
		expect(sober.options.map((o) => o.number)).toEqual([1]);

		const washer = infoPicker(
			night1.game,
			night1.seat('washerwoman'),
			'washerwoman',
			night1.characters
		)!;
		const monk = night1.seat('monk');
		expect(isAllowed(washer, { seats: [monk, night1.seat('butler')], characterId: 'monk' })).toBe(
			true
		);
		expect(
			isAllowed(washer, {
				seats: [night1.seat('butler'), night1.seat('poisoner')],
				characterId: 'monk'
			})
		).toBe(false);
	});

	it('night 1: the Fortune Teller gets yes for the Imp and for the Red Herring, no otherwise', () => {
		const ft = infoPicker(
			night1.game,
			night1.seat('fortuneteller'),
			'fortuneteller',
			night1.characters
		)!;
		const s = night1;
		expect(isAllowed(ft, { seats: [s.seat('imp'), s.seat('washerwoman')], yes: true })).toBe(true);
		expect(isAllowed(ft, { seats: [s.seat('monk'), s.seat('washerwoman')], yes: true })).toBe(true);
		expect(isAllowed(ft, { seats: [s.seat('washerwoman'), s.seat('empath')], yes: true })).toBe(
			false
		);
	});

	// ── Day 1: the Poisoner's token comes off at dusk; the Butler is executed ──
	const day1 = night1.newDay();
	const dusk1 = day1.execute('butler').dusk();

	it('day 1: Poisoned stays through the day and comes off at dusk', () => {
		expect(labels(day1, 'empath')).toContain('poisoner:Poisoned');
		expect(labels(dusk1, 'empath')).not.toContain('poisoner:Poisoned');
		expect(dusk1.game.seats[dusk1.seat('butler')].dead).toBe(true);
		expect(gameEnds(dusk1.game, dusk1.characters)).toEqual([]);
	});

	// ── Night 2: the Poisoner poisons the Monk, who protects the Empath; the Imp kills the
	// Ravenkeeper, who wakes to learn a character ──
	const night2 = dusk1
		.reminder('monk', 'poisoner', 'Poisoned')
		.reminder('empath', 'monk', 'Safe')
		.reminder('ravenkeeper', 'imp', 'Dead')
		.dies('ravenkeeper', 'demon');

	it('night 2 wakes the Poisoner, Monk, Imp, the killed Ravenkeeper, then the info, in order', () => {
		expect(wakes(night2, [night2.seat('ravenkeeper')])).toEqual([
			'dusk',
			'poisoner',
			'monk',
			'imp',
			'ravenkeeper',
			'empath',
			'fortuneteller',
			'dawn'
		]);
	});

	it('night 2: a sober Monk saves the Empath from the Imp; a poisoned one does not', () => {
		const attacked = dusk1.reminder('empath', 'monk', 'Safe').reminder('empath', 'imp', 'Dead');
		expect(preventedDeaths(attacked.game, attacked.characters)).toMatchObject([
			{ seatId: attacked.seat('empath'), because: [{ kind: 'protected' }] }
		]);
		// Poisoned, the Monk's Safe gives no reason the Empath lives: the kill goes ahead.
		const poisoned = attacked.reminder('monk', 'poisoner', 'Poisoned');
		expect(preventedDeaths(poisoned.game, poisoned.characters)).toMatchObject([
			{ seatId: poisoned.seat('empath'), because: [] }
		]);
	});

	// ── Day 2: Safe comes off at dawn; the Imp is executed and good wins ──
	const day2 = night2.newDay();

	it('day 2: the Monk’s Safe comes off at dawn', () => {
		expect(labels(night2, 'empath')).toContain('monk:Safe');
		expect(labels(day2, 'empath')).not.toContain('monk:Safe');
	});

	it('day 2: executing the Imp with no Scarlet Woman ends the game, good wins', () => {
		const end = day2.execute('imp');
		expect(gameEnds(end.game, end.characters)[0]).toMatchObject({ winner: 'good' });
	});
});

// A second table: registration (the Spy and the Recluse), a Drunk, the Virgin, the Undertaker
// and the Imp passing its star to the Scarlet Woman.
const cast2 = [
	'chef',
	'investigator',
	'librarian',
	'undertaker',
	'virgin',
	'soldier',
	'recluse',
	'spy',
	'scarletwoman',
	'imp'
];

describe('a Trouble Brewing game with registration and a star pass (M42)', () => {
	// The Soldier's player is the Drunk.
	const setup = scenario(cast2, { script }).drunk('soldier');

	it('night 1: the Chef counts the evil pair, and one more if the Recluse registers evil', () => {
		const chef = infoPicker(setup.game, setup.seat('chef'), 'chef', setup.characters)!;
		// The Spy, the Scarlet Woman and the Imp sit together: 2 pairs; the Recluse beside the Spy.
		expect(chef.options.find((o) => !o.registered)?.number).toBe(2);
		expect(isAllowed(chef, { seats: [], number: 2 })).toBe(true);
		expect(isAllowed(chef, { seats: [], number: 3 })).toBe(true);
		expect(isAllowed(chef, { seats: [], number: 0 })).toBe(false);
	});

	it('night 1: the Investigator may be shown the Recluse as a Minion, not a Townsfolk', () => {
		const inv = infoPicker(
			setup.game,
			setup.seat('investigator'),
			'investigator',
			setup.characters
		)!;
		const s = setup;
		expect(
			isAllowed(inv, {
				seats: [s.seat('scarletwoman'), s.seat('chef')],
				characterId: 'scarletwoman'
			})
		).toBe(true);
		expect(
			isAllowed(inv, { seats: [s.seat('recluse'), s.seat('chef')], characterId: 'poisoner' })
		).toBe(true);
		expect(
			isAllowed(inv, { seats: [s.seat('chef'), s.seat('virgin')], characterId: 'poisoner' })
		).toBe(false);
	});

	it('night 1: the Librarian may be shown the Drunk, the Recluse, or the Spy as an Outsider', () => {
		const lib = infoPicker(setup.game, setup.seat('librarian'), 'librarian', setup.characters)!;
		const s = setup;
		expect(
			isAllowed(lib, { seats: [s.seat('soldier'), s.seat('chef')], characterId: 'drunk' })
		).toBe(true);
		expect(
			isAllowed(lib, { seats: [s.seat('recluse'), s.seat('chef')], characterId: 'recluse' })
		).toBe(true);
		expect(isAllowed(lib, { seats: [s.seat('spy'), s.seat('chef')], characterId: 'butler' })).toBe(
			true
		);
		expect(
			isAllowed(lib, { seats: [s.seat('chef'), s.seat('virgin')], characterId: 'butler' })
		).toBe(false);
	});

	it('night 1: the Drunk Soldier and the Undertaker do not wake', () => {
		const ids = wakes(setup);
		expect(ids).not.toContain('soldier');
		expect(ids).not.toContain('undertaker');
		expect(ids).toEqual(expect.arrayContaining(['spy', 'chef', 'investigator', 'librarian']));
	});

	// ── Day 1: the Drunk nominates the Virgin (nothing happens); then the Chef does, and dies ──
	const day1 = setup.newDay();

	it('day 1: the Virgin executes the Chef, a Townsfolk, but not the Drunk', () => {
		const byDrunk = { nominator: day1.seat('soldier'), nominee: day1.seat('virgin') };
		expect(characterNominationPrompts(day1.game, byDrunk, day1.characters)).toEqual([]);
		const byChef = { nominator: day1.seat('chef'), nominee: day1.seat('virgin') };
		expect(characterNominationPrompts(day1.game, byChef, day1.characters)).toMatchObject([
			{ kind: 'execute-nominator', characterId: 'virgin' }
		]);
	});

	const executed = day1.nominate('chef', 'virgin').execute('chef');
	const night2 = executed.dusk();

	it('night 2: the Undertaker wakes and is shown the Chef executed today', () => {
		expect(wakes(night2)).toContain('undertaker');
		expect(
			nightAnswer(night2.game, night2.seat('undertaker'), 'undertaker', night2.characters)
		).toMatchObject({ kind: 'character', value: 'chef' });
	});

	it('night 2: the Imp kills itself and the Scarlet Woman is the one to catch the star', () => {
		const starred = night2.dies('imp', 'imp');
		expect(starPass(starred.game, starred.characters)).toMatchObject({
			characterId: 'imp',
			preferred: starred.seat('scarletwoman'),
			preferredBy: 'scarletwoman'
		});
		const caught = starred.becomes('scarletwoman', 'imp');
		expect(gameEnds(caught.game, caught.characters)).toEqual([]);
		// Day 2: the new Imp is executed, and good wins.
		const day2 = caught.newDay().execute('scarletwoman');
		expect(gameEnds(day2.game, day2.characters)[0]).toMatchObject({ winner: 'good' });
	});
});
