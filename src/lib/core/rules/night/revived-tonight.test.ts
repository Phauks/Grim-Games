/**
 * A player revived tonight wakes only at steps after the ability that revived them
 * (`revivedAfterStep`), from https://wiki.bloodontheclocktower.com/Shabaloth: a regurgitated
 * player whose step comes before the Shabaloth's does not act that night.
 */
import { describe, expect, it } from 'vitest';
import { scenario } from '#lib/core/testing/scenario.ts';
import { revivedSinceNewDay } from './night-numbers.ts';
import { revivedAfterStep } from './revived-tonight.ts';

describe('revivedAfterStep', () => {
	const order = ['dusk', 'exorcist', 'shabaloth', 'chef', 'dawn'];
	const base = scenario(['exorcist', 'shabaloth', 'chef', 'empath']).dies('exorcist').newDay();
	const back = base
		.do((at) => ({ type: 'SetDead', seatId: at.seat('exorcist'), dead: false }))
		.reminder('exorcist', 'shabaloth', 'Alive');
	const revived = revivedSinceNewDay(back.session.log.entries.flatMap((e) => e.events));

	it('lists seats revived since the New day', () => {
		expect([...revived]).toEqual([back.seat('exorcist')]);
	});

	it('skips steps before the reviving ability, not after', () => {
		const at = (step: string) =>
			revivedAfterStep(back.game, back.seat('exorcist'), step, order, back.characters, revived);
		expect(at('exorcist')).toBe(true);
		expect(at('chef')).toBe(false);
	});

	it('needs a reviving token and a revival tonight', () => {
		const noToken = base.do((at) => ({
			type: 'SetDead',
			seatId: at.seat('exorcist'),
			dead: false
		}));
		const r = revivedSinceNewDay(noToken.session.log.entries.flatMap((e) => e.events));
		expect(
			revivedAfterStep(
				noToken.game,
				noToken.seat('exorcist'),
				'exorcist',
				order,
				noToken.characters,
				r
			)
		).toBe(false);
		expect(
			revivedAfterStep(
				back.game,
				back.seat('exorcist'),
				'exorcist',
				order,
				back.characters,
				new Set()
			)
		).toBe(false);
	});
});
