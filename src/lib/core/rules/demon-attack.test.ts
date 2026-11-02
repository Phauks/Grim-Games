/**
 * M15a: the Demon may choose not to attack (`demonAttack`: the Toymaker,
 * https://wiki.bloodontheclocktower.com/Toymaker). The Demon is marked Final Night: No Attack
 * at the start; taking it off records that it chose not to attack; while it is still on, the
 * Demon's step reminds the Storyteller, and on a night its attack could end the game it
 * doesn't wake or attack.
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { attackCouldEndGame, demonAttackRule, noAttackState } from './demon-attack.ts';
import { nightStepAlerts } from './night-alerts.ts';
import { setupReminders } from './setup-reminders.ts';

const TOKEN = 'Final Night: No Attack';
// Seat 0 Imp, then five good players.
const cast = ['imp', 'washerwoman', 'empath', 'monk', 'soldier', 'chef'];
const toymaker: Command = { type: 'AddRuleCharacter', characterId: 'toymaker' };
const mark = (s: string[]): Command => ({
	type: 'AddReminder',
	seatId: s[0],
	reminder: { characterId: 'toymaker', label: TOKEN }
});
const dead =
	(i: number) =>
	(s: string[]): Command => ({ type: 'SetDead', seatId: s[i], dead: true });
const kinds = (g: ReturnType<typeof castGame>) =>
	nightStepAlerts(g.game, 'imp', characters).map((a) => a.kind);

describe('demonAttack part', () => {
	it('reads maySkip and a mustSkipOnce token of the character', () => {
		const issues = new Issues();
		const rules = parseCharacterRules(
			{ demonAttack: { maySkip: true, mustSkipOnce: TOKEN } },
			'x',
			issues,
			[TOKEN]
		);
		expect(issues.list).toEqual([]);
		expect(rules?.demonAttack).toEqual({ maySkip: true, mustSkipOnce: TOKEN });
	});

	it('rejects a token the character does not have, and a missing maySkip', () => {
		const issues = new Issues();
		parseCharacterRules({ demonAttack: { maySkip: true, mustSkipOnce: 'Nope' } }, 'x', issues, [
			TOKEN
		]);
		parseCharacterRules({ demonAttack: {} }, 'y', issues, [TOKEN]);
		expect(issues.list.length).toBe(2);
	});
});

describe('demonAttackRule and noAttackState', () => {
	it('no rule without the Toymaker in play', () => {
		const g = castGame(cast);
		expect(demonAttackRule(g.game, characters)).toBeUndefined();
		expect(noAttackState(g.game, g.seats[0], characters)).toBeUndefined();
	});

	it('the Toymaker in play: only the Demon gets a state', () => {
		const g = castGame(cast, toymaker);
		expect(demonAttackRule(g.game, characters)).toEqual({
			characterId: 'toymaker',
			mustSkipOnce: TOKEN
		});
		expect(noAttackState(g.game, g.seats[1], characters)).toBeUndefined();
		expect(noAttackState(g.game, g.seats[0], characters)).toEqual({
			rule: { characterId: 'toymaker', mustSkipOnce: TOKEN },
			finalNight: false
		});
	});

	it('the token on the Demon is pending until it comes off', () => {
		const g = castGame(cast, toymaker, mark);
		const state = noAttackState(g.game, g.seats[0], characters);
		expect(state?.pending).toBeDefined();
		const after = castGame(cast, toymaker, mark, (s) => ({
			type: 'RemoveReminder',
			reminderId: g.game.seats[s[0]].reminders[0].reminderId
		}));
		expect(noAttackState(after.game, after.seats[0], characters)?.pending).toBeUndefined();
	});

	it('the attack could end the game with 3 players alive, not with 4', () => {
		expect(attackCouldEndGame(castGame(cast, dead(1), dead(2)).game, characters)).toBe(false);
		expect(attackCouldEndGame(castGame(cast, dead(1), dead(2), dead(3)).game, characters)).toBe(
			true
		);
	});
});

describe('the Demon’s night step alerts', () => {
	it('may choose not to attack once the token is off', () => {
		expect(kinds(castGame(cast, toymaker))).toContain('may-skip-attack');
	});

	it('still marked: reminds that it must choose not to attack once', () => {
		const k = kinds(castGame(cast, toymaker, mark));
		expect(k).toContain('must-skip-attack');
		expect(k).not.toContain('final-night');
	});

	it('still marked with 3 alive: final night, no kill alerts follow', () => {
		const k = kinds(castGame(cast, toymaker, mark, dead(1), dead(2), dead(3)));
		expect(k).toContain('final-night');
		// The Monk would protect, the Soldier is safe: none of that matters tonight.
		expect(k).not.toContain('protected');
	});

	it('nothing for a step that is not the Demon’s kill', () => {
		const g = castGame(cast, toymaker, mark);
		expect(nightStepAlerts(g.game, 'monk', characters).some((a) => a.kind.endsWith('attack'))).toBe(
			false
		);
	});
});

describe('setup', () => {
	it('suggests putting Final Night: No Attack on the Demon', () => {
		const g = castGame(cast, toymaker);
		expect(setupReminders(g.game, characters)).toContainEqual(
			expect.objectContaining({ characterId: 'toymaker', label: TOKEN, seatId: g.seats[0] })
		);
	});
});
