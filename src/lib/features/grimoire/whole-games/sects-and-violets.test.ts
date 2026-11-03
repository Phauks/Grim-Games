/**
 * A whole Sects and Violets game, night by night, through the engine (M42): who wakes each
 * night, the Vortox turning every Townsfolk's information false, the Witch's curse, the
 * Sweetheart and the Sage waking only on the night they die, the Juggler on the night after the
 * first day, the Snake Charmer swapping with the Demon, and how the game ends. Each character
 * has its own tests; this finds what goes wrong between them over a game (Trevor, 2026-11-03:
 * "Whole-game run-throughs").
 *
 * Rules: https://wiki.bloodontheclocktower.com/Sects_%26_Violets and each character's page.
 */
import { describe, expect, it } from 'vitest';
import { editionScript, toScript } from '#lib/core/data/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import {
	characterNominationPrompts,
	gameEnds,
	infoPicker,
	isAllowed,
	type NightStep
} from '#lib/core/rules/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { boardNightSteps, stepWakes, tonight } from '../night-steps.ts';

const data = committedGameData();
const script = toScript(editionScript('snv', data)!);

// Ten players: 6 Townsfolk, 1 Outsider, 2 Minions, 1 Demon (the Vortox).
const cast = [
	'clockmaker',
	'dreamer',
	'snakecharmer',
	'juggler',
	'sage',
	'flowergirl',
	'sweetheart',
	'witch',
	'cerenovus',
	'vortox'
];

function wakes(s: Scenario, diedTonight: SeatId[] = []): string[] {
	return boardNightSteps(s.game, s.characters, tonight(s.game), data)
		.filter((step: NightStep) =>
			stepWakes(s.game, step, s.characters, { diedTonight: new Set(diedTonight) })
		)
		.map((step) => step.id);
}

describe('a Sects and Violets game (M42)', () => {
	const setup = scenario(cast, { script });

	it('night 1 wakes the evil team, the Snake Charmer, the Minions, then the first-night info', () => {
		expect(wakes(setup)).toEqual([
			'dusk',
			'minioninfo',
			'demoninfo',
			'snakecharmer',
			'witch',
			'cerenovus',
			'clockmaker',
			'dreamer',
			'dawn'
		]);
	});

	it('night 1: with the Vortox alive, the Clockmaker is told a false number', () => {
		// Wiki (Vortox): "While the Vortox is alive, you must give false information whenever a Townsfolk ability prompts you to give information."
		const clock = infoPicker(setup.game, setup.seat('clockmaker'), 'clockmaker', setup.characters)!;
		// The Cerenovus sits next to the Vortox: the true distance is 1.
		expect(isAllowed(clock, { seats: [], number: 1 })).toBe(false);
		expect(isAllowed(clock, { seats: [], number: 2 })).toBe(true);
	});

	it('night 1: the Dreamer is not shown the true character', () => {
		// Wiki (Vortox): "While the Vortox is alive, you must give false information whenever a Townsfolk ability prompts you to give information."
		const dreamer = infoPicker(setup.game, setup.seat('dreamer'), 'dreamer', setup.characters)!;
		const clockmaker = setup.seat('clockmaker');
		expect(isAllowed(dreamer, { seats: [clockmaker], characterId: 'clockmaker' })).toBe(false);
		expect(isAllowed(dreamer, { seats: [clockmaker], characterId: 'witch' })).toBe(true);
	});

	// Night 1: the Witch curses the Juggler.
	const day1 = setup.reminder('juggler', 'witch', 'Cursed').newDay();

	it('day 1: the cursed Juggler nominates and dies', () => {
		// Wiki (Witch): "The next day, if the player marked '''CURSED''' makes a nomination, immediately declare that they die."
		const nomination = { nominator: day1.seat('juggler'), nominee: day1.seat('sage') };
		expect(characterNominationPrompts(day1.game, nomination, day1.characters)).toMatchObject([
			{ kind: 'kills-nominator', characterId: 'witch', nominator: day1.seat('juggler') }
		]);
		const byOther = { nominator: day1.seat('sage'), nominee: day1.seat('juggler') };
		expect(characterNominationPrompts(day1.game, byOther, day1.characters)).toEqual([]);
	});

	it('day 1: a day with no execution ends the game at dusk, evil wins', () => {
		// Wiki (Vortox): "Each dusk, if no player was executed today, the game ends and the evil team wins."
		const quiet = day1.dusk();
		expect(gameEnds(quiet.game, quiet.characters, { dayEnded: true })[0]).toMatchObject({
			rule: 'day-without-execution',
			winner: 'evil'
		});
	});

	// Day 1: the Juggler dies to the curse; the Sweetheart is executed.
	const dusk1 = day1
		.nominate('juggler', 'sage')
		.dies('juggler', 'witch')
		.nominate('sage', 'sweetheart')
		.execute('sweetheart')
		.dusk();
	const diedToday = [dusk1.seat('juggler'), dusk1.seat('sweetheart')];

	it('day 1: an execution keeps the game going', () => {
		expect(gameEnds(dusk1.game, dusk1.characters, { dayEnded: true })).toEqual([]);
	});

	it('night 2: the Sweetheart’s step comes the night it died; the dead Juggler and the living Sage sleep', () => {
		// Wiki (Sweetheart): "If the Sweetheart dies, you choose any one player to become '''drunk''' - mark this player with the '''DRUNK''' reminder."
		// Wiki (Sage): "If the Sage was killed by the Demon, wake the Sage."
		const ids = wakes(dusk1, diedToday);
		expect(ids).toContain('sweetheart');
		expect(ids).not.toContain('juggler');
		expect(ids).not.toContain('sage');
		expect(ids).toEqual(expect.arrayContaining(['vortox', 'witch', 'cerenovus', 'dreamer']));
	});

	it('night 2: the Juggler would wake on the night after the first day, if alive', () => {
		// Wiki (Juggler): "That night, wake the Juggler."
		const alive = setup.newDay().nominate('sage', 'sweetheart').execute('sweetheart').dusk();
		expect(wakes(alive, [alive.seat('sweetheart')])).toContain('juggler');
		expect(wakes(alive.newDay().execute('dreamer').dusk())).not.toContain('juggler');
	});

	// Night 2: the Vortox kills the Sage.
	const night2 = dusk1.reminder('sage', 'vortox', 'Dead').dies('sage', 'vortox');

	it('night 2: the Sage killed by the Vortox wakes and learns two players, neither the Demon', () => {
		expect(wakes(night2, [...diedToday, night2.seat('sage')])).toContain('sage');
		// Wiki (Vortox): "The Vortox kills the {{Good|Sage}}. The {{Good|Sage}} learns two players, both of which are not Demons."
		const sage = infoPicker(night2.game, night2.seat('sage'), 'sage', night2.characters)!;
		const s = night2;
		expect(isAllowed(sage, { seats: [s.seat('vortox'), s.seat('dreamer')] })).toBe(false);
		expect(isAllowed(sage, { seats: [s.seat('clockmaker'), s.seat('dreamer')] })).toBe(true);
	});

	it('night 2: a Sage killed by a Minion does not wake', () => {
		const byWitch = dusk1.dies('sage', 'witch');
		expect(wakes(byWitch, [...diedToday, byWitch.seat('sage')])).not.toContain('sage');
	});

	// Day 2: the Cerenovus is executed. Night 3: the Snake Charmer chooses the Vortox and the two
	// swap, the old Vortox now a poisoned good Snake Charmer.
	const charmed = night2
		.newDay()
		.nominate('dreamer', 'cerenovus')
		.execute('cerenovus')
		.dusk()
		.becomes('snakecharmer', 'vortox', 'evil')
		.becomes('vortox', 'snakecharmer', 'good')
		.reminder('vortox', 'snakecharmer', 'Poisoned');

	it('night 3: the Snake Charmer becomes the evil Demon, and the game goes on', () => {
		// Wiki (Snake Charmer): "If that player is the Demon, the old Snake Charmer changes into the new (''evil'') Demon, and the old Demon changes into the new (''good'') Snake Charmer"
		expect(gameEnds(charmed.game, charmed.characters)).toEqual([]);
		expect(wakes(charmed)).toContain('vortox');
	});

	it('day 3: executing the new Vortox ends the game, good wins', () => {
		const end = charmed.newDay().nominate('clockmaker', 'snakecharmer').execute('snakecharmer');
		expect(gameEnds(end.game, end.characters)[0]).toMatchObject({ winner: 'good' });
	});
});
