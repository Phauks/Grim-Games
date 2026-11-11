/**
 * Whole Trouble Brewing games with Travellers and with Fabled, night by night, through the
 * engine (M76): an exile is not an execution, Travellers don't count for "two alive", and a
 * Fabled changes the night only once it is in play. Each character has its own tests; this finds
 * what goes wrong between them over a game (Trevor, 2026-11-09: "More whole-game run-throughs").
 *
 * Rules: https://wiki.bloodontheclocktower.com/Glossary and each character's page.
 */
import { describe, expect, it } from 'vitest';
import { editionScript, toScript } from '#lib/core/data/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import { gameEnds } from '#lib/core/rules/game-end/game-end.ts';
import { infoPicker } from '#lib/core/rules/night/info/picker.ts';
import { noAttackState } from '#lib/core/rules/night/demon-attack.ts';
import { type NightStep } from '#lib/core/rules/night/night-order.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { boardNightSteps, stepWakes, tonight } from '#lib/core/rules/night/board-steps.ts';

const data = committedGameData();
const tb = toScript(editionScript('tb', data)!);
const withCharacters = (ids: string[]) => ({
	...tb,
	entries: [...tb.entries, ...ids.map((id) => ({ kind: 'official' as const, id }))]
});

function wakes(s: Scenario, diedTonight: SeatId[] = []): string[] {
	return boardNightSteps(s.game, s.characters, tonight(s.game), data)
		.filter((step: NightStep) =>
			stepWakes(s.game, step, s.characters, { diedTonight: new Set(diedTonight) })
		)
		.map((step) => step.id);
}

const winners = (s: Scenario) =>
	gameEnds(s.game, s.characters, { dayEnded: true }).map((e) => `${e.winner}:${e.rule}`);

describe('a Trouble Brewing game with Travellers (M76)', () => {
	const travellers = ['scapegoat', 'bureaucrat', 'thief', 'bonecollector', 'gunslinger'];
	const cast = ['saint', 'mayor', 'empath', 'imp', 'poisoner', 'monk', ...travellers];
	const setup = scenario(cast, { script: withCharacters(travellers) });

	it('night 1: six players and five Travellers get no Minion or Demon info', () => {
		const ids = wakes(setup);
		expect(ids).toEqual(expect.arrayContaining(['bureaucrat', 'thief', 'poisoner', 'empath']));
		expect(ids).not.toContain('minioninfo');
		expect(ids).not.toContain('demoninfo');
	});

	const day1 = setup.newDay();

	it('day 1: exiling the Saint is not an execution, so good does not lose', () => {
		// Wiki (Glossary): "Though an exile is similar to a vote for execution, the process is not a vote, and an exile is not an execution."
		const exiled = day1.do((s) => ({ type: 'Exile', seatId: s.seat('saint') }));
		expect(winners(exiled)).toEqual([]);
		expect(winners(day1.execute('saint'))).toEqual(['evil:executed-loses']);
	});

	it('day 1: exiling a Traveller kills them and ends nothing', () => {
		const exiled = day1.do((s) => ({ type: 'Exile', seatId: s.seat('scapegoat') }));
		expect(exiled.game.seats[exiled.seat('scapegoat')].dead).toBe(true);
		expect(winners(exiled)).toEqual([]);
	});

	it('later: with only the Mayor and the Imp alive besides Travellers, evil wins', () => {
		const few = day1
			.dies('saint', 'imp')
			.dies('empath', 'imp')
			.dies('monk', 'imp')
			.dies('poisoner', 'imp');
		expect(winners(few)).toContain('evil:two-alive');
	});
});

describe('a Trouble Brewing game with Fabled (M76)', () => {
	const cast = ['washerwoman', 'empath', 'imp', 'poisoner', 'monk'];
	const plain = scenario(cast, { script: tb });

	it('night 1: five players get no Minion or Demon info without the Toymaker', () => {
		expect(wakes(plain)).not.toContain('minioninfo');
	});

	const toy = plain.rule('toymaker').reminder('imp', 'toymaker', 'Final Night: No Attack');

	it('night 1: with the Toymaker, evil learns each other at five players', () => {
		// Wiki (Toymaker): "On the first night, resolve the \"Minion info\" and \"Demon info” steps on the night sheet even though there are fewer than seven players."
		expect(wakes(toy)).toEqual(expect.arrayContaining(['toymaker', 'minioninfo', 'demoninfo']));
	});

	it('the final night: a Demon yet to skip an attack is warned not to wake', () => {
		// Wiki (Toymaker): "During any night, if the Demon would wake and their attack could end the game, but the Demon is marked '''FINAL NIGHT: NO ATTACK''', the Demon does not wake or act tonight."
		const early = toy.newDay().dusk();
		expect(noAttackState(early.game, early.seat('imp'), early.characters)).toMatchObject({
			finalNight: false
		});
		const late = early.dies('washerwoman', 'imp').newDay().execute('empath').dusk();
		expect(noAttackState(late.game, late.seat('imp'), late.characters)).toMatchObject({
			finalNight: true
		});
	});

	it('with the Fibbin in play, a good player’s information may be false', () => {
		// Wiki (Fibbin): "Once per game, when a good player gains information from an ability, you can give them incorrect information."
		const fibbin = plain.rule('fibbin');
		const sober = infoPicker(plain.game, plain.seat('empath'), 'empath', plain.characters)!;
		const fibbed = infoPicker(fibbin.game, fibbin.seat('empath'), 'empath', fibbin.characters)!;
		expect(sober.anyAllowed).toBe(false);
		expect(fibbed.anyAllowed).toBe(true);
	});
});
