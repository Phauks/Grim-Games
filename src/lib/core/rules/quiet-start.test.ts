/**
 * M15b: a quiet start to each day (`quietStart`: the Buddhist,
 * https://wiki.bloodontheclocktower.com/Buddhist). The veterans may not talk for the first two
 * minutes of each day; the day timer counts that down from its time used.
 */
import { describe, expect, it } from 'vitest';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { quietLeft, quietStartRule } from './quiet-start.ts';

const cast = ['imp', 'washerwoman', 'empath', 'monk', 'soldier'];

describe('quietStart part', () => {
	it('reads seconds and who stays quiet', () => {
		const issues = new Issues();
		const rules = parseCharacterRules(
			{ quietStart: { seconds: 90, players: 'veterans' } },
			'x',
			issues
		);
		expect(issues.list).toEqual([]);
		expect(rules?.quietStart).toEqual({ seconds: 90, players: 'veterans' });
	});

	it('rejects no time, and players it does not know', () => {
		const issues = new Issues();
		parseCharacterRules({ quietStart: { seconds: 0, players: 'veterans' } }, 'x', issues);
		parseCharacterRules({ quietStart: { seconds: 60, players: 'everyone' } }, 'y', issues);
		expect(issues.list.length).toBe(2);
	});
});

describe('quietStartRule', () => {
	it('none without the Buddhist in play', () => {
		expect(quietStartRule(castGame(cast).game, characters)).toBeUndefined();
	});

	it('the Buddhist in play: two minutes for the veterans', () => {
		const g = castGame(cast, { type: 'AddRuleCharacter', characterId: 'buddhist' });
		expect(quietStartRule(g.game, characters)).toEqual({
			characterId: 'buddhist',
			seconds: 120,
			players: 'veterans'
		});
	});
});

describe('quietLeft', () => {
	const rule = { seconds: 120 };
	it('counts down from two minutes as the day’s timer runs, then stays at 0', () => {
		expect(quietLeft(rule, 0)).toBe(120_000);
		expect(quietLeft(rule, 45_000)).toBe(75_000);
		expect(quietLeft(rule, 120_000)).toBe(0);
		expect(quietLeft(rule, 300_000)).toBe(0);
	});
});
