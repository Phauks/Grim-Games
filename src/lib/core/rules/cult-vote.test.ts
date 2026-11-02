/**
 * The Cult Leader's cult vote (`dayUse.vote: all-good-join`, game end `cult-joined`, M9d):
 * https://wiki.bloodontheclocktower.com/Cult_Leader. Once a day the Cult Leader may call a
 * vote; when every living good player joins, the Cult Leader's team wins at once. A poisoned
 * Cult Leader's cult doesn't form. The win is only offered: End game asks.
 */
import { describe, expect, it } from 'vitest';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { dayUseOf } from './day-claims.ts';
import { gameEnds, promptable } from './game-end.ts';

describe('the dayUse vote', () => {
	it('reads a vote in place of who', () => {
		const issues = new Issues();
		const read = (value: unknown) => parseCharacterRules({ dayUse: value }, 'x', issues)?.dayUse;
		expect(read({ vote: 'all-good-join' })).toEqual({ vote: 'all-good-join' });
		expect(read({ who: 'chosen' })).toEqual({ who: 'chosen' });
		expect(issues.list).toEqual([]);
	});

	it('needs who or a vote, and only one of them', () => {
		const issues = new Issues();
		parseCharacterRules({ dayUse: {} }, 'a', issues);
		parseCharacterRules({ dayUse: { who: 'chosen', vote: 'all-good-join' } }, 'b', issues);
		parseCharacterRules({ dayUse: { vote: 'majority' } }, 'c', issues);
		expect(issues.list).toEqual([
			'a.dayUse.who: missing',
			'b.dayUse: expected who or vote, not both',
			'c.dayUse.vote: unknown value "majority"',
			'c.dayUse.who: missing'
		]);
	});

	it('is the Cult Leader’s, in its official rules', () => {
		const s = scenario(['cultleader']);
		expect(dayUseOf('cultleader', s.characters)).toEqual({ vote: 'all-good-join' });
	});
});

describe('Cult Leader: the cult vote', () => {
	const base = scenario(['cultleader', 'chef', 'empath', 'imp', 'poisoner']);
	const vote = (s: typeof base, passed: boolean) =>
		s.do((at) => ({
			type: 'UseAbility',
			seatId: at.seat('cultleader'),
			characterId: 'cultleader',
			passed
		}));
	const cult = (s: typeof base) =>
		gameEnds(s.game, s.characters).filter((e) => e.rule === 'cult-joined');

	it('records the vote on its use, and a failed vote ends nothing', () => {
		const s = vote(base, false);
		expect(s.game.today.entries.at(-1)).toMatchObject({ kind: 'ability', passed: false });
		expect(cult(s)).toEqual([]);
	});

	it('offers a win for the Cult Leader’s team once every good player joined', () => {
		const good = vote(base.becomes('cultleader', 'cultleader', 'good'), true);
		expect(cult(good)).toEqual([
			expect.objectContaining({ winner: 'good', seats: [good.seat('cultleader')], holds: [] })
		]);
		expect(promptable(cult(good))).toHaveLength(1);
		const evil = vote(base.becomes('cultleader', 'cultleader', 'evil'), true);
		expect(cult(evil)).toEqual([expect.objectContaining({ winner: 'evil' })]);
	});

	it('is held while the Cult Leader is poisoned, so the prompt doesn’t open on its own', () => {
		const s = vote(base.becomes('cultleader', 'cultleader', 'good').poisoned('cultleader'), true);
		expect(cult(s)[0]?.holds).toEqual([expect.objectContaining({ rule: 'impaired' })]);
		expect(promptable(cult(s))).toEqual([]);
	});

	it('lasts only for the day the vote passed', () => {
		const s = vote(base.becomes('cultleader', 'cultleader', 'good'), true).newDay();
		expect(cult(s)).toEqual([]);
	});
});
