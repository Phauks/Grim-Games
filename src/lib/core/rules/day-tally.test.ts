/**
 * Today's counts (`dayTally`): the Yaggababble's phrase said aloud, each time letting one player
 * die from its ability, by day or that night (https://wiki.bloodontheclocktower.com/Yaggababble).
 */
import { describe, expect, it } from 'vitest';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { undo } from '#lib/core/engine/log.ts';
import { refused, warned } from '#lib/core/model/fixtures.test-support.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { dayTallyOf, tallyCount, tallyKiller, tallyKills } from './day-tally.ts';

const set = (count: number) => ({
	type: 'SetDayTally' as const,
	characterId: 'yaggababble',
	count
});

describe('dayTally', () => {
	const day = scenario(['yaggababble', 'chef', 'empath', 'monk']).newDay();

	it('starts at none, and each new day starts at none again', () => {
		expect(tallyCount(day.game.today, 'yaggababble')).toBe(0);
		const two = day.do(set(2));
		expect(two.game.today.tallies).toEqual({ yaggababble: { count: 2 } });
		const next = two.newDay();
		expect(next.game.today.tallies).toBeUndefined();
		expect(tallyCount(next.game.pastDays.at(-1)!, 'yaggababble')).toBe(2);
	});

	it('clears at 0 and undoes', () => {
		const two = day.do(set(2));
		expect('tallies' in two.do(set(0)).game.today).toBe(false);
		expect(undo(two.session).game.today.tallies).toBeUndefined();
	});

	it('refuses a count that is not a whole number, and warns on no change', () => {
		expect(refused(day.session, day.ctx, set(-1))).toBe('invalid-day-tally');
		expect(refused(day.session, day.ctx, set(1.5))).toBe('invalid-day-tally');
		expect(warned(day.session, day.ctx, set(0))).toEqual(['no-change']);
		expect(
			warned(day.session, day.ctx, { type: 'SetDayTally', characterId: 'chef', count: 1 })
		).toEqual(['no-day-tally']);
	});

	it('counts deaths by the character against today’s count, and warns past it', () => {
		const one = day.do(set(1));
		const cause = { type: 'SetDead' as const, dead: true, cause: 'yaggababble' };
		expect(warned(one.session, one.ctx, { ...cause, seatId: one.seat('chef') })).toEqual([]);
		const died = one.dies('chef', 'yaggababble');
		expect(tallyKills(died.game, 'yaggababble', died.characters)).toEqual({
			count: 1,
			died: [died.seat('chef')],
			left: 0,
			over: false
		});
		expect(warned(died.session, died.ctx, { ...cause, seatId: died.seat('empath') })).toEqual([
			'beyond-tally'
		]);
		// Lowering the count below the deaths warns too.
		expect(warned(died.session, died.ctx, set(0))).toEqual(['beyond-tally']);
	});

	it('leaves out other causes, and a player brought back', () => {
		const one = day.do(set(1)).dies('chef', 'imp');
		expect(tallyKills(one.game, 'yaggababble', one.characters)?.left).toBe(1);
		const back = day
			.do(set(1))
			.dies('chef', 'yaggababble')
			.do((s) => ({ type: 'SetDead', seatId: s.seat('chef'), dead: false }));
		expect(tallyKills(back.game, 'yaggababble', back.characters)?.left).toBe(1);
		// A cause recorded later counts too.
		const later = day
			.do(set(1))
			.dies('chef')
			.do((s) => ({ type: 'SetDeathCause', seatId: s.seat('chef'), cause: 'yaggababble' }));
		expect(tallyKills(later.game, 'yaggababble', later.characters)?.died).toEqual([
			later.seat('chef')
		]);
	});

	it('is only for a character with a kills tally', () => {
		expect(tallyKills(day.game, 'chef', day.characters)).toBeUndefined();
		expect(tallyKiller('yaggababble', day.characters)).toBe('yaggababble');
		expect(tallyKiller('imp', day.characters)).toBeUndefined();
		expect(dayTallyOf(undefined)).toBeUndefined();
	});

	it('reads a label and an optional kills', () => {
		const issues = new Issues();
		parseCharacterRules({ dayTally: { kills: false } }, 'x', issues);
		expect(issues.list).toEqual(['x.dayTally.label: missing', 'x.dayTally.kills: expected true']);
	});
});
