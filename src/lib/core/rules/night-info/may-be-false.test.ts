/**
 * `falseInfo` with `may` (M15e): a character that lets a good player's information be false
 * once per game, spent by its token (the Fibbin, https://wiki.bloodontheclocktower.com/Fibbin).
 */
import { describe, expect, it } from 'vitest';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { abnormalCauses, infoPicker, isAllowed } from './picker.ts';
import { answerOptions, nightAnswer } from './answers.ts';
import { mayBeFalseSource, reliability } from './reliability.ts';

const cast = () => scenario(['empath', 'imp', 'chef', 'monk', 'spy']).rule('fibbin');

/** The Empath's picker, and whether it allows `n`. */
function empath(s: Scenario) {
	const picker = infoPicker(s.game, s.seat('empath'), 'empath', s.characters, 'other')!;
	return { picker, allows: (n: number) => isAllowed(picker, { seats: [], number: n }) };
}

/** Records the Empath being shown `n`, as Show to player does, with its abnormal causes. */
function show(s: Scenario, n: number): Scenario {
	const { picker } = empath(s);
	const abnormal = abnormalCauses(picker, { seats: [], number: n });
	return s.do({
		type: 'RecordNightInfo',
		seatId: s.seat('empath'),
		characterId: 'empath',
		text: String(n),
		...(abnormal.length > 0 ? { abnormal } : {})
	});
}

describe('falseInfo may (Fibbin)', () => {
	it('lets a good player be given any number while it is unspent', () => {
		const s = cast();
		expect(reliability(s.game, s.seat('empath'), 'empath', s.characters).mayBeFalse).toBe('fibbin');
		const { picker, allows } = empath(s);
		expect(picker.anyAllowed).toBe(true);
		expect(allows(1)).toBe(true);
		expect(allows(0)).toBe(true);
		expect(abnormalCauses(picker, { seats: [], number: 0 })).toEqual([
			{ reason: 'vortox', characterId: 'fibbin' }
		]);
	});

	it('does nothing for an evil player', () => {
		const s = cast();
		expect(mayBeFalseSource(s.game, s.seat('spy'), 'minion', s.characters)).toBeUndefined();
	});

	it('does nothing without the Fibbin in play', () => {
		const s = scenario(['empath', 'imp', 'chef', 'monk', 'spy']);
		expect(empath(s).picker.anyAllowed).toBe(false);
	});

	it('is spent by false information: its No Ability goes on the Fibbin', () => {
		const s = show(cast(), 0);
		expect(s.game.ruleReminders?.fibbin?.map((r) => r.label)).toEqual(['No Ability']);
		const { allows } = empath(s);
		expect(allows(0)).toBe(false);
		expect(allows(1)).toBe(true);
	});

	it('is not spent by true information', () => {
		const s = show(cast(), 1);
		expect(s.game.ruleReminders?.fibbin ?? []).toEqual([]);
		expect(empath(s).picker.anyAllowed).toBe(true);
	});

	it('comes back when the false record is removed', () => {
		const s = show(cast(), 0);
		const entry = s.game.today.entries.findLast((e) => e.kind === 'info')!;
		const after = s.do({ type: 'RemoveDayEntry', entryId: entry.entryId });
		expect(after.game.ruleReminders?.fibbin ?? []).toEqual([]);
		expect(empath(after).picker.anyAllowed).toBe(true);
	});

	it('also lets an answer be anything (the Undertaker, Oracle and the rest)', () => {
		const s = scenario(['oracle', 'imp', 'chef', 'monk', 'spy']).rule('fibbin');
		const a = nightAnswer(s.game, s.seat('oracle'), 'oracle', s.characters, undefined, 'other')!;
		expect(a.mayBeFalse).toBe('fibbin');
		expect(answerOptions(s.game, a, s.characters)[0]?.reason).toBe('true');
	});

	it('reads may, alignment and spentToken; types stay required without may', () => {
		const issues = new Issues();
		const rules = parseCharacterRules(
			{ falseInfo: { may: true, alignment: 'good', spentToken: 'No Ability' } },
			'x',
			issues,
			['No Ability']
		);
		expect(issues.list).toEqual([]);
		expect(rules?.falseInfo).toEqual({ may: true, alignment: 'good', spentToken: 'No Ability' });
		const bad = new Issues();
		parseCharacterRules({ falseInfo: {} }, 'x', bad, []);
		expect(bad.list.length).toBeGreaterThan(0);
	});
});

describe('Fibbin wiki examples, worked by the engine (M15e)', () => {
	// The ability test file holds the verbatim examples; these check what the app allows.
	it('Example 1: the Empath is told 1 with two good neighbours, then the rest is true', () => {
		// The Empath sits between the Chef and the Monk here, both good.
		const s0 = scenario(['chef', 'empath', 'monk', 'imp', 'spy']).rule('fibbin');
		const pick = (s: Scenario) =>
			infoPicker(s.game, s.seat('empath'), 'empath', s.characters, 'other')!;
		expect(isAllowed(pick(s0), { seats: [], number: 1 })).toBe(true);
		const abnormal = abnormalCauses(pick(s0), { seats: [], number: 1 });
		const s1 = s0.do({
			type: 'RecordNightInfo',
			seatId: s0.seat('empath'),
			characterId: 'empath',
			text: '1',
			abnormal
		});
		expect(isAllowed(pick(s1), { seats: [], number: 1 })).toBe(false);
	});
});
