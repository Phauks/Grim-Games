/**
 * Wishes (`wish`): https://wiki.bloodontheclocktower.com/Wizard. Granted or declined, with an
 * optional price and clue, and a standard effect the app acts on.
 */
import { describe, expect, it } from 'vitest';
import { abilityState } from './ability.ts';
import { grantedWish, grantedWishSeats, makesWish, wishWithEffect, wishes } from './wishes.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

const cast = ['wizard', 'chef', 'empath', 'poisoner', 'imp'];

const wish =
	(granted: boolean, extra: Record<string, string> = {}) =>
	(at: Scenario) => ({
		type: 'RecordWish' as const,
		seatId: at.seat('wizard'),
		characterId: 'wizard',
		text: 'A wish',
		granted,
		...extra
	});

describe('wishes', () => {
	it('knows which characters make a wish', () => {
		expect(makesWish('wizard')).toBe(true);
		expect(makesWish('chef')).toBe(false);
	});

	it('keeps every wish across days, and only a granted one counts', () => {
		const s = scenario(cast)
			.do(wish(false))
			.newDay()
			.do(wish(true, { price: ' ', clue: 'Hmm' }));
		expect(wishes(s.game).map((w) => w.granted)).toEqual([false, true]);
		expect(grantedWish(s.game, s.seat('wizard'))).toMatchObject({ clue: 'Hmm' });
		// A blank price is no price.
		expect(grantedWish(s.game, s.seat('wizard'))).not.toHaveProperty('price');
		expect(grantedWishSeats(s.game)).toEqual([s.seat('wizard')]);
	});

	it('a second granted wish only warns', () => {
		const s = scenario(cast).do(wish(true), wish(true));
		expect(wishes(s.game)).toHaveLength(2);
		expect(s.session.log.entries.at(-1)?.warnings?.map((w) => w.code)).toContain('already-wished');
	});

	it('a declined wish carries no effect', () => {
		const s = scenario(cast).do(wish(false, { effect: 'good-drunk' }));
		expect(wishWithEffect(s.game, 'good-drunk')).toBeUndefined();
		expect(abilityState(s.game, s.seat('chef'), s.characters).works).toBe(true);
	});

	it('editing a wish replaces it, and removing it ends its effect', () => {
		const s = scenario(cast).do(wish(false));
		const entryId = wishes(s.game)[0].entryId;
		const granted = s.do((at) => ({ ...wish(true, { effect: 'good-drunk' })(at), entryId }));
		expect(wishes(granted.game)).toHaveLength(1);
		expect(abilityState(granted.game, s.seat('chef'), s.characters).impairments).toMatchObject([
			{ reason: 'drunk', source: { characterId: 'wizard' } }
		]);
		const removed = granted.do({ type: 'RemoveDayEntry', entryId });
		expect(abilityState(removed.game, s.seat('chef'), s.characters).works).toBe(true);
	});
});
