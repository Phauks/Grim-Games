/**
 * Whole games with Experimental characters, night by night, through the engine (M76): who wakes
 * each night, what the info steps allow, the Lleech living through its own execution while its
 * host lives, and the Princess stopping one night's kill. Each character has its own tests; this
 * finds what goes wrong between them over a game (Trevor, 2026-11-09: "More whole-game
 * run-throughs").
 *
 * Rules: each character's page on https://wiki.bloodontheclocktower.com.
 */
import { describe, expect, it } from 'vitest';
import type { SeatId } from '#lib/core/model/index.ts';
import { gameEnds } from '#lib/core/rules/game-end/game-end.ts';
import { infoPicker, isAllowed } from '#lib/core/rules/night/info/picker.ts';
import { nightKill } from '#lib/core/rules/night/night-kill.ts';
import { type NightStep } from '#lib/core/rules/night/night-order.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { boardNightSteps, stepWakes, tonight } from '#lib/core/rules/night/board-steps.ts';

const data = committedGameData();

function wakes(s: Scenario, diedTonight: SeatId[] = []): string[] {
	return boardNightSteps(s.game, s.characters, tonight(s.game), data)
		.filter((step: NightStep) =>
			stepWakes(s.game, step, s.characters, { diedTonight: new Set(diedTonight) })
		)
		.map((step) => step.id);
}

const labels = (s: Scenario, ref: string) =>
	s.game.seats[s.seat(ref)].reminders.map((r) => `${r.characterId}:${r.label}`);

describe('an Experimental game with the Lleech (M76)', () => {
	const cast = [
		'noble',
		'knight',
		'huntsman',
		'damsel',
		'villageidiot',
		'banshee',
		'widow',
		'harpy',
		'lleech'
	];
	const setup = scenario(cast);

	it('night 1 wakes the Lleech, the Widow and the first-night info, not the Banshee', () => {
		const ids = wakes(setup);
		expect(ids).toEqual(
			expect.arrayContaining(['lleech', 'widow', 'harpy', 'huntsman', 'knight', 'noble'])
		);
		expect(ids.indexOf('lleech')).toBeLessThan(ids.indexOf('noble'));
		expect(ids).not.toContain('banshee');
	});

	it('night 1: the Knight learns two players who are not the Demon', () => {
		// Wiki (Knight): "During setup, mark two non-Demon players with the Knight’s '''KNOW''' reminders."
		const knight = infoPicker(setup.game, setup.seat('knight'), 'knight', setup.characters)!;
		const s = setup;
		expect(isAllowed(knight, { seats: [s.seat('noble'), s.seat('damsel')] })).toBe(true);
		expect(isAllowed(knight, { seats: [s.seat('noble'), s.seat('lleech')] })).toBe(false);
	});

	// Night 1: the Lleech poisons the Knight, its host.
	const day1 = setup.reminder('knight', 'lleech', 'Poisoned').newDay();

	it('day 1: the Lleech survives its execution while its host lives', () => {
		// Wiki (Lleech): "If the Lleech would die but the player marked with the Lleech’s '''POISONED''' reminder is alive, the Lleech does not die."
		const executed = day1.execute('lleech');
		expect(executed.game.seats[executed.seat('lleech')].dead).toBe(false);
		expect(gameEnds(executed.game, executed.characters)).toEqual([]);
	});

	it('day 1: executing the host kills the Lleech, and good wins', () => {
		// Wiki (Lleech): "If the player marked with the Lleech’s '''POISONED''' reminder '''is dead''', the Lleech '''dies''' and the good team wins."
		const executed = day1.execute('knight');
		expect(gameEnds(executed.game, executed.characters)[0]).toMatchObject({ winner: 'good' });
	});

	// Day 1: the Banshee is executed.
	const night2 = day1.execute('banshee').dusk();

	it('night 2: the Lleech kills; first-night characters and the executed Banshee sleep', () => {
		// Wiki (Lleech): "Each night except the first, wake the Lleech. They point at any player. That player '''dies'''"
		const ids = wakes(night2, [night2.seat('banshee')]);
		expect(ids).toEqual(expect.arrayContaining(['lleech', 'harpy', 'huntsman', 'villageidiot']));
		for (const once of ['widow', 'knight', 'noble', 'banshee']) expect(ids).not.toContain(once);
		expect(nightKill(night2.game, night2.seat('lleech'), 'lleech', night2.characters)).toEqual({
			max: 1,
			delayed: []
		});
	});
});

describe('an Experimental game with the Princess (M76)', () => {
	const cast = [
		'princess',
		'shugenja',
		'steward',
		'cultleader',
		'ogre',
		'hermit',
		'xaan',
		'wizard',
		'ojo'
	];
	const setup = scenario(cast);

	it('night 1: the Shugenja learns the closest evil player is anticlockwise', () => {
		// Wiki (Shugenja): "If the closest evil player is in an anti-clockwise direction, point your finger horizontally in that direction."
		// The Ojo sits two seats anticlockwise; the Xaan five seats clockwise.
		const shugenja = infoPicker(setup.game, setup.seat('shugenja'), 'shugenja', setup.characters)!;
		expect(shugenja.options).toHaveLength(1);
		expect(isAllowed(shugenja, { seats: [], yes: false })).toBe(true);
		expect(isAllowed(shugenja, { seats: [], yes: true })).toBe(false);
	});

	// Day 1: the Princess nominates the Hermit, who is executed; the Demon is marked.
	const night2 = setup
		.newDay()
		.nominate('princess', 'hermit')
		.execute('hermit')
		.dusk()
		.reminder('ojo', 'princess', "Doesn't Kill");

	it('night 2: the Demon kills no one', () => {
		// Wiki (Princess): "If the Princess nominates and executes a player, mark the Demon with the '''DOESN'T KILL''' reminder."
		// Wiki (Princess): "Tonight, if the Demon would wake to choose a player, wake them as normal. The Demon does not kill."
		expect(wakes(night2)).toContain('ojo');
		expect(nightKill(night2.game, night2.seat('ojo'), 'ojo', night2.characters)).toEqual({
			max: 0,
			delayed: []
		});
	});

	it('night 3: the Demon kills again, as Doesn’t Kill came off at dawn', () => {
		// Wiki (Princess): "Tonight, if the Demon would wake to choose a player, wake them as normal. The Demon does not kill."
		const day2 = night2.newDay();
		expect(labels(day2, 'ojo')).not.toContain("princess:Doesn't Kill");
		const night3 = day2.dusk();
		expect(nightKill(night3.game, night3.seat('ojo'), 'ojo', night3.characters)).toEqual({
			max: 1,
			delayed: []
		});
	});
});
