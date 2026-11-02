/**
 * Effects the Storyteller picks for a reminder (`pickedEffect`): the Angel's Something Bad, here
 * that the Demon kills no one on the next night (https://wiki.bloodontheclocktower.com/Angel).
 */
import { describe, expect, it } from 'vitest';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { undo } from '#lib/core/engine/log.ts';
import { refused, warned } from '#lib/core/model/fixtures.test-support.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { nightStepAlerts } from './night-alerts.ts';
import { effectNight, pickedEffectOf, stopsKillingTonight } from './reminder-effects.ts';

describe('pickedEffect', () => {
	const base = scenario(['chef', 'empath', 'imp'])
		.rule('angel')
		.newDay()
		.reminder('imp', 'angel', 'Something Bad')
		.reminder('chef', 'angel', 'Protected');
	const bad = base.game.seats[base.seat('imp')].reminders[0];
	const protectedToken = base.game.seats[base.seat('chef')].reminders[0];
	const pick = (night: number, reminderId = bad.reminderId) => ({
		type: 'SetReminderEffect' as const,
		reminderId,
		effect: { kind: 'no-kill' as const, night }
	});

	it('is offered on its token only', () => {
		expect(pickedEffectOf(bad, base.characters)).toEqual({
			token: 'Something Bad',
			effects: ['no-kill']
		});
		expect(pickedEffectOf(protectedToken, base.characters)).toBeUndefined();
	});

	it('acts on the next night: the coming one by day, the one after tonight at night', () => {
		expect(effectNight(base.game, false)).toBe(2);
		expect(effectNight(base.game, true)).toBe(3);
	});

	it('stops the marked player killing on its night only', () => {
		const picked = base.do(pick(2));
		expect(picked.game.seats[base.seat('imp')].reminders[0].effect).toEqual({
			kind: 'no-kill',
			night: 2
		});
		expect(stopsKillingTonight({ kind: 'no-kill', night: 2 }, picked.game)).toBe(true);
		expect(nightStepAlerts(picked.game, 'imp', picked.characters).map((a) => a.kind)).toEqual([
			'no-kill'
		]);
		const later = base.do(pick(3));
		expect(nightStepAlerts(later.game, 'imp', later.characters).map((a) => a.kind)).not.toContain(
			'no-kill'
		);
	});

	it('clears and undoes, and warns on a token whose rules do not list it', () => {
		const picked = base.do(pick(2));
		const cleared = picked.do({ type: 'SetReminderEffect', reminderId: bad.reminderId });
		expect('effect' in cleared.game.seats[base.seat('imp')].reminders[0]).toBe(false);
		expect(undo(picked.session).game.seats[base.seat('imp')].reminders[0].effect).toBeUndefined();
		expect(warned(picked.session, picked.ctx, pick(2))).toEqual(['no-change']);
		expect(warned(base.session, base.ctx, pick(2, protectedToken.reminderId))).toEqual([
			'effect-not-listed'
		]);
		expect(refused(base.session, base.ctx, pick(0))).toBe('invalid-effect');
	});

	it('reads its token and known effects', () => {
		const issues = new Issues();
		parseCharacterRules({ pickedEffect: { token: 'B', effects: ['x'] } }, 'y', issues, ['A']);
		expect(issues.list).toEqual([
			'y.pickedEffect.token: not one of this character’s reminders',
			'y.pickedEffect.effects: expected some of no-kill'
		]);
	});
});
