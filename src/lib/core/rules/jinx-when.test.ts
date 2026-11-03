/**
 * A jinx effect's `when` conditions (`jinx-when.ts`), read the same for every verb. The
 * conditions are the app's, not the wiki's: each jinx that uses one is tested with its jinx in
 * `src/lib/core/jinxes/`.
 */
import { describe, expect, it } from 'vitest';
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
