/**
 * Executions that fail or are forced (`executionOutcome`, M9d): the Legion's
 * (https://wiki.bloodontheclocktower.com/Legion), the Judge's
 * (https://wiki.bloodontheclocktower.com/Judge) and the Vizier's
 * (https://wiki.bloodontheclocktower.com/Vizier). Each test paraphrases the page it cites.
 */
import { describe, expect, it } from 'vitest';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { warned } from '#lib/core/model/fixtures.test-support.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import {
	executionOutcomes,
	outcomeHolders,
	outcomeProblem,
	votersAnswer
} from './execution-outcome.ts';

describe('the executionOutcome part', () => {
	it('reads failsIf, force and executeNow', () => {
		const issues = new Issues();
		const read = (value: unknown) =>
			parseCharacterRules({ executionOutcome: value }, 'x', issues)?.executionOutcome;
		expect(read({ failsIf: 'only-evil-voted' })).toEqual({ failsIf: 'only-evil-voted' });
		expect(read({ force: 'pass-or-fail' })).toEqual({ force: 'pass-or-fail' });
		expect(read({ executeNow: 'good-voted' })).toEqual({ executeNow: 'good-voted' });
		expect(issues.list).toEqual([]);
	});

	it('refuses an unknown value, an unknown key and an empty block', () => {
		const issues = new Issues();
		parseCharacterRules({ executionOutcome: { failsIf: 'nobody-voted' } }, 'a', issues);
		parseCharacterRules({ executionOutcome: { force: 'pass-or-fail', once: true } }, 'b', issues);
		parseCharacterRules({ executionOutcome: {} }, 'c', issues);
		expect(issues.list).toEqual([
			'a.executionOutcome.failsIf: unknown value "nobody-voted"',
			'a.executionOutcome: expected failsIf, force or executeNow',
			expect.stringContaining('b.executionOutcome'),
			'c.executionOutcome: expected failsIf, force or executeNow'
		]);
	});

	it('is in the official rules of the Legion, the Judge and the Vizier', () => {
		const s = scenario(['legion', 'judge', 'vizier', 'chef', 'empath']);
		expect(outcomeHolders(s.game, s.characters)).toEqual([
			{ kind: 'fails', characterId: 'legion', seatId: s.seat('legion'), works: true },
			{ kind: 'force', characterId: 'judge', seatId: s.seat('judge'), works: true },
			{ kind: 'execute-now', characterId: 'vizier', seatId: s.seat('vizier'), works: true }
		]);
	});
});

// https://wiki.bloodontheclocktower.com/Legion: when only evil players voted for the nominee,
// their tally counts as zero and the execution fails.
describe('Legion: executions fail if only evil voted', () => {
	const base = scenario(['legion', 'legion', 'legion', 'chef', 'empath']);

	it('is one offer for several Legion players, and needs no nomination', () => {
		const offers = executionOutcomes(base.game, base.seat('chef'), base.characters);
		expect(offers).toEqual([
			{ kind: 'fails', characterId: 'legion', seatId: base.seat(0), works: true }
		]);
	});

	it('still works while one Legion lives, and is gone once every one is dead', () => {
		const one = base.dies(0).dies(1);
		expect(executionOutcomes(one.game, one.seat('chef'), one.characters)).toEqual([
			{ kind: 'fails', characterId: 'legion', seatId: one.seat(2), works: true }
		]);
		const none = one.dies(2);
		expect(executionOutcomes(none.game, none.seat('chef'), none.characters)).toEqual([]);
	});

	it('logs a failed execution: nobody dies, and the day may still have an execution', () => {
		const s = base.nominate(0, 'chef').do((at) => ({
			type: 'Execute',
			seatId: at.seat('chef'),
			outcome: { kind: 'failed', characterId: 'legion' }
		}));
		expect(s.game.seats[s.seat('chef')].dead).toBe(false);
		expect(s.game.today.entries.at(-1)).toEqual({
			kind: 'execution-failed',
			entryId: expect.any(String),
			seatId: s.seat('chef'),
			by: { characterId: 'legion', seatId: s.seat(0) }
		});
		// Another nominee with a good vote may still be executed (the page's example).
		expect(warned(s.session, s.ctx, { type: 'Execute', seatId: s.seat('empath') })).toEqual([]);
	});

	it('works the answer out from recorded voters, once there are any', () => {
		expect(votersAnswer(base.game, 'only-evil-voted', undefined)).toBeUndefined();
		expect(votersAnswer(base.game, 'only-evil-voted', [base.seat(0), base.seat(1)])).toBe(true);
		expect(votersAnswer(base.game, 'only-evil-voted', [base.seat(0), base.seat('chef')])).toBe(
			false
		);
		expect(votersAnswer(base.game, 'only-evil-voted', [])).toBe(false);
	});
});

// https://wiki.bloodontheclocktower.com/Judge: once per game, on a nomination another player
// made, the Judge may make that execution pass (executed whatever the tally) or fail; the
// "No Ability" reminder then marks it spent.
describe('Judge: force the current execution to pass or fail', () => {
	const base = scenario(['judge', 'chef', 'empath', 'imp', 'poisoner']);

	it('applies only to a nominee another player nominated', () => {
		const offer = (s: typeof base) =>
			executionOutcomes(s.game, s.seat('imp'), s.characters)[0]?.problem;
		expect(offer(base)).toBe('not-nominated');
		expect(offer(base.nominate('judge', 'imp'))).toBe('own-nomination');
		expect(offer(base.nominate('chef', 'imp'))).toBeUndefined();
	});

	it('forces a pass: the nominee is executed and the ruling marked used on them', () => {
		const s = base.nominate('chef', 'imp').do((at) => ({
			type: 'Execute',
			seatId: at.seat('imp'),
			outcome: { kind: 'forced', characterId: 'judge' }
		}));
		expect(s.game.seats[s.seat('imp')].dead).toBe(true);
		expect(s.game.seats[s.seat('judge')].reminders).toEqual([
			expect.objectContaining({ characterId: 'judge', label: 'No Ability' })
		]);
		expect(s.game.today.entries.slice(1)).toEqual([
			expect.objectContaining({ kind: 'ability', characterId: 'judge', on: s.seat('imp') }),
			expect.objectContaining({
				kind: 'execution',
				seatId: s.seat('imp'),
				died: true,
				forcedBy: { characterId: 'judge', seatId: s.seat('judge') }
			})
		]);
		// Once per game: a second ruling may not apply.
		const later = s.newDay().nominate('chef', 'empath');
		expect(executionOutcomes(later.game, later.seat('empath'), later.characters)[0]?.problem).toBe(
			'used'
		);
	});

	it('forces a fail: logged as failed, and the ruling marked used', () => {
		const s = base.nominate('chef', 'imp').do((at) => ({
			type: 'Execute',
			seatId: at.seat('imp'),
			outcome: { kind: 'failed', characterId: 'judge' }
		}));
		expect(s.game.seats[s.seat('imp')].dead).toBe(false);
		expect(s.game.today.entries.at(-1)).toMatchObject({
			kind: 'execution-failed',
			by: { characterId: 'judge' }
		});
		expect(s.game.seats[s.seat('judge')].reminders).toHaveLength(1);
	});

	it('warns, and still records it, on a nomination the Judge made or while poisoned', () => {
		const own = base.nominate('judge', 'imp');
		const forced = { type: 'Execute', seatId: own.seat('imp') } as const;
		const outcome = { kind: 'forced', characterId: 'judge' } as const;
		expect(warned(own.session, own.ctx, { ...forced, outcome })).toEqual(['outcome-may-not-apply']);
		const poisoned = base.poisoned('judge').nominate('chef', 'imp');
		// A poisoned Judge has no working ability, so nothing is offered.
		expect(executionOutcomes(poisoned.game, poisoned.seat('imp'), poisoned.characters)).toEqual([]);
		expect(outcomeProblem(poisoned.game, poisoned.seat('imp'), outcome, poisoned.characters)).toBe(
			'not-working'
		);
	});

	it('warns when no character in play can give that outcome', () => {
		const s = base.nominate('chef', 'imp');
		expect(
			warned(s.session, s.ctx, {
				type: 'Execute',
				seatId: s.seat('imp'),
				outcome: { kind: 'failed', characterId: 'legion' }
			})
		).toEqual(['outcome-may-not-apply']);
	});
});

// https://wiki.bloodontheclocktower.com/Vizier: right after a vote with at least one good
// voter, the Vizier may execute the nominee, majority or not; that is the day's execution.
describe('Vizier: execute now once a good player voted', () => {
	const base = scenario(['vizier', 'chef', 'empath', 'imp', 'poisoner']);

	it('is offered for a player nominated today', () => {
		expect(executionOutcomes(base.game, base.seat('imp'), base.characters)[0]?.problem).toBe(
			'not-nominated'
		);
		const s = base.nominate('chef', 'imp');
		expect(executionOutcomes(s.game, s.seat('imp'), s.characters)).toEqual([
			{ kind: 'execute-now', characterId: 'vizier', seatId: s.seat('vizier'), works: true }
		]);
	});

	it('records the execution as forced by the Vizier, with no day use marked', () => {
		const s = base.nominate('chef', 'imp').do((at) => ({
			type: 'Execute',
			seatId: at.seat('imp'),
			outcome: { kind: 'forced', characterId: 'vizier' }
		}));
		expect(s.game.today.entries.at(-1)).toMatchObject({
			kind: 'execution',
			died: true,
			forcedBy: { characterId: 'vizier', seatId: s.seat('vizier') }
		});
		expect(s.game.seats[s.seat('vizier')].reminders).toEqual([]);
	});

	it('works the good vote out from recorded voters', () => {
		expect(votersAnswer(base.game, 'good-voted', [base.seat('imp'), base.seat('chef')])).toBe(true);
		expect(votersAnswer(base.game, 'good-voted', [base.seat('imp')])).toBe(false);
	});
});
