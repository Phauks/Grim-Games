/**
 * Jinx Chambermaid + Mathematician: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Chambermaid
 * Wiki: https://wiki.bloodontheclocktower.com/Mathematician
 * (the wiki has no jinx page; each character's page lists the jinx under "Related Jinxes")
 */
import { describe, expect, it } from 'vitest';
import { findJinx, jinxesAmong } from '#lib/core/data/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import type { SeatId } from '#lib/core/model/types.ts';
import { infoPicker } from '#lib/core/rules/night-info.ts';
import type { Night } from '#lib/core/rules/night-order.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { scriptOf } from './summoner.test-support.ts';

describe('Chambermaid + Mathematician jinx', () => {
	const data = committedGameData();
	const jinx = findJinx(data.jinxes, 'chambermaid', 'mathematician');

	it('is in jinxes.json between two official characters', () => {
		expect(data.byId.get('chambermaid')?.name).toBe('Chambermaid');
		expect(data.byId.get('mathematician')?.name).toBe('Mathematician');
		expect(jinx).toBeDefined();
		expect(jinx?.reason).not.toBe('');
	});

	it('applies only when both characters are on the script', () => {
		expect(jinxesAmong(data.jinxes, ['chambermaid', 'mathematician'])).toContain(jinx);
		expect(jinxesAmong(data.jinxes, ['chambermaid'])).not.toContain(jinx);
		expect(jinxesAmong(data.jinxes, ['mathematician'])).not.toContain(jinx);
	});

	describe('the Chambermaid detects the Mathematician, who wakes after them', () => {
		const cast = ['chambermaid', 'mathematician', 'soldier', 'empath', 'imp'];
		const base = scenario(cast, { script: scriptOf(cast) });
		const learns = (s: Scenario, night: Night, a: string, b: string) => {
			const picker = infoPicker(s.game, s.seat('chambermaid'), 'chambermaid', s.characters, night)!;
			const pair: SeatId[] = [s.seat(a), s.seat(b)];
			return picker.options.find(
				(o) => o.seats.length === 2 && pair.every((id) => o.seats.includes(id))
			)?.number;
		};

		it('the Mathematician wakes later in the night than the Chambermaid', () => {
			// Wiki: "The Chambermaid can detect if the Mathematician will wake tonight."
			for (const night of ['firstNight', 'otherNight'] as const) {
				const order = data.nightSheet[night];
				expect(order.indexOf('mathematician'), night).toBeGreaterThan(order.indexOf('chambermaid'));
			}
		});

		it('counts the Mathematician as waking tonight, every night', () => {
			// Wiki: "The Chambermaid can detect if the Mathematician will wake tonight."
			expect(learns(base, 'first', 'mathematician', 'soldier')).toBe(1);
			const next = base.newDay();
			expect(learns(next, 'other', 'mathematician', 'soldier')).toBe(1);
			expect(learns(next, 'other', 'mathematician', 'empath')).toBe(2);
		});

		it('counts a poisoned Mathematician, who still wakes', () => {
			// Wiki: "if the Mathematician will wake tonight"
			const poisoned = base.newDay().poisoned('mathematician');
			expect(learns(poisoned, 'other', 'mathematician', 'soldier')).toBe(1);
		});
	});
});
