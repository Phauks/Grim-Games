/**
 * A jinx effect's `when` conditions (`jinx-when.ts`), read the same for every verb. The
 * conditions are the app's, not the wiki's: each jinx that uses one is tested with its jinx in
 * `src/lib/core/rules-tests/jinxes/`.
 */
import { describe, expect, it } from 'vitest';
import { flipCondition } from '#lib/core/data/jinx-needs.ts';
import type { JinxCondition } from '#lib/core/data/jinx-rules.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { aboutHolder, jinxApplies, type JinxBoard } from './jinx-when.ts';

const s = scenario(['chef', 'empath', 'imp', 'monk']);
const holds = (when: JinxCondition[], game: JinxBoard = s.game, at = {}) =>
	jinxApplies(game, 'chef', 'imp', { when }, s.characters, at);

describe('jinxApplies', () => {
	it('holds with no conditions, and only when every one holds', () => {
		expect(holds([])).toBe(true);
		expect(jinxApplies(s.game, 'chef', 'imp', undefined, s.characters)).toBe(true);
		expect(holds(['self-in-play', 'partner-in-play'])).toBe(true);
		expect(holds(['self-in-play', 'partner-alive'], s.dies('imp').game)).toBe(false);
	});

	it('reads alive and in play for each character, and for the player in question', () => {
		const dead = s.dies('imp');
		expect(holds(['partner-in-play'], dead.game)).toBe(true);
		expect(holds(['partner-alive'], dead.game)).toBe(false);
		expect(jinxApplies(s.game, 'chef', 'baron', { when: ['partner-in-play'] }, s.characters)).toBe(
			false
		);
		const chefDead = s.dies('chef');
		expect(holds(['self-alive'], chefDead.game)).toBe(false);
		expect(holds(['self-alive'], s.game, { seatId: s.seat('chef') })).toBe(true);
	});

	it('counts days and nights from the past days', () => {
		expect(holds([{ night: 1 }])).toBe(true);
		expect(holds([{ day: 1 }])).toBe(false);
		const day1 = s.newDay();
		expect(holds([{ night: 1 }], day1.game)).toBe(false);
		expect(holds([{ day: 1 }], day1.game)).toBe(true);
		expect(holds([{ afterDay: 1 }], day1.game)).toBe(true);
		expect(holds([{ afterDay: 2 }], day1.game)).toBe(false);
	});

	it('holds after an execution today only', () => {
		const day = s.newDay();
		expect(holds(['after-execution'], day.game)).toBe(false);
		expect(holds(['after-execution'], day.execute('monk').game)).toBe(true);
	});

	it('reads a reminder on the self player, or on the partner player', () => {
		expect(holds([{ marked: 'Dead' }])).toBe(false);
		expect(holds([{ marked: 'Dead' }], s.reminder('chef', 'imp', 'Dead').game)).toBe(true);
		expect(holds([{ partnerMarked: 'Dead' }], s.reminder('imp', 'chef', 'Dead').game)).toBe(true);
	});

	it('reads the alignment of the self player, or of a partner player', () => {
		const evil = (on: string) =>
			({ type: 'SetAlignment', seatId: s.seat(on), alignment: 'evil' }) as const;
		expect(holds([{ alignment: 'good' }])).toBe(true);
		expect(holds([{ alignment: 'evil' }])).toBe(false);
		expect(holds([{ alignment: 'evil' }], s.do(evil('chef')).game)).toBe(true);
		expect(holds([{ partnerAlignment: 'evil' }])).toBe(true);
		expect(holds([{ partnerAlignment: 'good' }])).toBe(false);
	});

	it('reads the final day as 3 or fewer living players', () => {
		expect(holds(['final-day'])).toBe(false);
		expect(holds(['final-day'], s.dies('monk').game)).toBe(true);
	});

	it('holds a partner ability only where the reader found one, and the board unread', () => {
		expect(holds(['has-partner-ability'])).toBe(false);
		expect(holds(['has-partner-ability'], s.game, { hasPartnerAbility: true })).toBe(true);
		expect(aboutHolder({ when: ['self-alive', 'has-partner-ability'] })).toBe(true);
		expect(aboutHolder({ when: ['self-alive'] })).toBe(false);
		// Only the script known: the board's conditions may hold.
		expect(
			holds(['partner-alive', { marked: 'Dead' }, 'final-day'], { script: s.game.script })
		).toBe(true);
	});
});

describe('jinxApplies: negation, deaths, executions and third characters (M44)', () => {
	const t = scenario(['chef', 'empath', 'imp', 'monk', 'saint']);
	const at = (when: JinxCondition[], game: JinxBoard = t.game, more = {}) =>
		jinxApplies(game, 'chef', 'imp', { when }, t.characters, more);

	it('reads a dead player of either character, which needs one in play', () => {
		expect(at(['self-dead'])).toBe(false);
		expect(at(['self-dead'], t.dies('chef').game)).toBe(true);
		expect(at(['partner-dead'], t.dies('imp').game)).toBe(true);
		// No Baron in play: not dead, though not alive either.
		expect(jinxApplies(t.game, 'chef', 'baron', { when: ['partner-dead'] }, t.characters)).toBe(
			false
		);
		expect(
			jinxApplies(t.game, 'chef', 'baron', { when: [{ not: 'partner-alive' }] }, t.characters)
		).toBe(true);
	});

	it('turns any condition round with not, unchecked when the board is unknown', () => {
		expect(at([{ not: 'self-alive' }])).toBe(false);
		expect(at([{ not: 'self-alive' }], t.dies('chef').game)).toBe(true);
		expect(at([{ not: { night: 1 } }])).toBe(false);
		expect(at([{ not: { not: 'self-in-play' } }])).toBe(true);
		expect(at([{ not: 'partner-alive' }], { script: t.game.script })).toBe(true);
	});

	it("reads an execution of either character's player today", () => {
		const day = t.newDay();
		expect(at(['partner-executed'], day.game)).toBe(false);
		expect(at(['partner-executed'], day.execute('imp').game)).toBe(true);
		expect(at(['self-executed'], day.execute('imp').game)).toBe(false);
		expect(at(['self-executed'], day.execute('chef').game)).toBe(true);
	});

	it("reads a nomination today between the two characters' players, either way (M46)", () => {
		const day = t.newDay();
		expect(at(['nominated-partner'], day.game)).toBe(false);
		expect(at(['nominated-partner'], day.nominate('chef', 'imp').game)).toBe(true);
		expect(at(['nominated-by-partner'], day.nominate('chef', 'imp').game)).toBe(false);
		expect(at(['nominated-by-partner'], day.nominate('imp', 'chef').game)).toBe(true);
		// Someone else's nomination, or yesterday's, is not one.
		expect(at(['nominated-partner'], day.nominate('monk', 'imp').game)).toBe(false);
		expect(at(['nominated-partner'], day.nominate('chef', 'imp').newDay().game)).toBe(false);
	});

	it('reads a third character on the script, alive or in play, from either side', () => {
		expect(at([{ alive: 'saint' }])).toBe(true);
		expect(at([{ alive: 'saint' }], t.dies('saint').game)).toBe(false);
		expect(at([{ inPlay: 'saint' }], t.dies('saint').game)).toBe(true);
		expect(at([{ inPlay: 'baron' }])).toBe(false);
		expect(at([{ not: { inPlay: 'baron' } }])).toBe(true);
		expect(jinxApplies(t.game, 'imp', 'chef', { when: [{ alive: 'saint' }] }, t.characters)).toBe(
			true
		);
	});

	it('reads alive, executions and the day at an event, not now', () => {
		const later = t.dies('saint').newDay();
		const event = { day: 0, entries: [], alive: [t.seat('saint'), t.seat('chef')] };
		expect(at([{ alive: 'saint' }], later.game)).toBe(false);
		expect(at([{ alive: 'saint' }, { night: 1 }], later.game, { event })).toBe(true);
		expect(at(['after-execution'], later.game, { event })).toBe(false);
		expect(at(['final-day'], later.game, { event })).toBe(true);
	});
});

describe('flipCondition', () => {
	it("swaps self and partner, inside a not too, and keeps a third character's", () => {
		expect(flipCondition('self-dead')).toBe('partner-dead');
		expect(flipCondition('partner-executed')).toBe('self-executed');
		expect(flipCondition('nominated-partner')).toBe('nominated-by-partner');
		expect(flipCondition('nominated-by-partner')).toBe('nominated-partner');
		expect(flipCondition({ not: 'self-alive' })).toEqual({ not: 'partner-alive' });
		expect(flipCondition({ alive: 'saint' })).toEqual({ alive: 'saint' });
		expect(flipCondition({ not: { inPlay: 'saint' } })).toEqual({ not: { inPlay: 'saint' } });
	});
});
