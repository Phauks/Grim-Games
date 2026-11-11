/**
 * `dayUse.anyone`, `who: 'ally'` and `minAlive` (M15d): a Fabled's day ability any living
 * player may use once per game (the Doomsayer, https://wiki.bloodontheclocktower.com/Doomsayer).
 */
import { describe, expect, it } from 'vitest';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { decide, type Command } from '#lib/core/engine/index.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import {
	anyoneDayUses,
	dayUseCandidates,
	dayUseDeath,
	dayUseOpen,
	dayUseUsers,
	isDayUseAlly
} from './day-claims.ts';

const cast = () =>
	scenario(['monk', 'washerwoman', 'poisoner', 'baron', 'imp', 'chef']).rule('doomsayer');

/** Logs `by` using the Doomsayer and the Storyteller killing `dies` by it. */
function doom(s: Scenario, by: string, dies: string): Scenario {
	return s
		.do({ type: 'UseAbility', seatId: s.seat(by), characterId: 'doomsayer', on: s.seat(dies) })
		.dies(dies, 'doomsayer');
}

/** The warning codes `command` gets. */
function warnings(s: Scenario, command: Command): string[] {
	const d = decide(s.game, command, s.ctx);
	return d.ok ? d.warnings.map((w) => w.code) : [`refused:${d.error.code}`];
}

describe('day use by anyone (Doomsayer)', () => {
	it('lets every living player use it while 4 or more live', () => {
		const s = cast();
		expect(anyoneDayUses(s.game, s.characters)).toEqual(['doomsayer']);
		expect(dayUseCandidates(s.game, 'doomsayer', s.characters)).toEqual(s.seats);
	});

	it('logs the use without a seat-character warning, and kills by the Doomsayer', () => {
		const s = cast();
		const use: Command = {
			type: 'UseAbility',
			seatId: s.seat('monk'),
			characterId: 'doomsayer',
			on: s.seat('washerwoman')
		};
		expect(warnings(s, use)).toEqual([]);
		expect(dayUseDeath(s.game, 'doomsayer', s.seat('washerwoman'), s.characters)).toBe('dies');
		const after = doom(s, 'monk', 'washerwoman');
		expect(after.game.seats[after.seat('washerwoman')]).toMatchObject({
			dead: true,
			deathCause: 'doomsayer'
		});
		expect(dayUseUsers(after.game, 'doomsayer')).toEqual([after.seat('monk')]);
	});

	it('is once per game for each player, across days', () => {
		const s = doom(cast(), 'monk', 'washerwoman').newDay();
		expect(dayUseCandidates(s.game, 'doomsayer', s.characters)).not.toContain(s.seat('monk'));
		const again: Command = {
			type: 'UseAbility',
			seatId: s.seat('monk'),
			characterId: 'doomsayer',
			on: s.seat('chef')
		};
		expect(warnings(s, again)).toEqual(['already-used']);
	});

	it('warns when the player picked is not a living ally, or the user is dead', () => {
		const s = cast();
		expect(isDayUseAlly(s.game, s.seat('monk'), s.seat('imp'))).toBe(false);
		expect(isDayUseAlly(s.game, s.seat('monk'), s.seat('monk'))).toBe(true);
		expect(
			warnings(s, {
				type: 'UseAbility',
				seatId: s.seat('monk'),
				characterId: 'doomsayer',
				on: s.seat('imp')
			})
		).toEqual(['not-ally']);
		const dead = s.dies('chef');
		expect(
			warnings(dead, {
				type: 'UseAbility',
				seatId: dead.seat('chef'),
				characterId: 'doomsayer'
			})
		).toEqual(['already-dead']);
	});

	it('closes once only 3 players live', () => {
		const s = cast().dies('chef').dies('baron');
		expect(dayUseOpen(s.game, 'doomsayer', s.characters)).toBe(true);
		const three = s.dies('washerwoman');
		expect(dayUseOpen(three.game, 'doomsayer', three.characters)).toBe(false);
		expect(dayUseCandidates(three.game, 'doomsayer', three.characters)).toEqual([]);
		expect(
			warnings(three, {
				type: 'UseAbility',
				seatId: three.seat('monk'),
				characterId: 'doomsayer'
			})
		).toEqual(['too-few-alive']);
	});

	it('reads anyone and minAlive', () => {
		const issues = new Issues();
		const rules = parseCharacterRules(
			{ dayUse: { who: 'ally', kills: true, anyone: true, minAlive: 4 } },
			'x',
			issues,
			[]
		);
		expect(issues.list).toEqual([]);
		expect(rules?.dayUse).toEqual({ who: 'ally', kills: true, anyone: true, minAlive: 4 });
		const bad = new Issues();
		parseCharacterRules({ dayUse: { who: 'ally', anyone: false, minAlive: 0 } }, 'x', bad, []);
		expect(bad.list.length).toBe(2);
	});
});

describe('Doomsayer wiki examples, worked by the engine (M15d)', () => {
	// The ability test file holds the verbatim examples; these check what the app records.
	it('Example 1: a good use kills a good player, an evil use an evil one', () => {
		const s = scenario(['monk', 'washerwoman', 'poisoner', 'baron', 'imp', 'chef']).rule(
			'doomsayer'
		);
		const after = doom(doom(s, 'monk', 'washerwoman'), 'poisoner', 'baron');
		expect(dayUseUsers(after.game, 'doomsayer')).toEqual([
			after.seat('monk'),
			after.seat('poisoner')
		]);
		expect(after.game.seats[after.seat('baron')].deathCause).toBe('doomsayer');
		expect(dayUseCandidates(after.game, 'doomsayer', after.characters)).toEqual([
			after.seat('imp'),
			after.seat('chef')
		]);
	});
});
