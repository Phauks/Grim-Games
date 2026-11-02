/**
 * Effects the Storyteller picks for a reminder (`pickedEffect`): the Angel's Something Bad
 * (https://wiki.bloodontheclocktower.com/Angel). How to Run lists poisoned, mad or no vote today
 * and recommends death, no ability for a day or no vote for a day; its example has the Demon
 * kill no one on the next night.
 */
import { describe, expect, it } from 'vitest';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { undo } from '#lib/core/engine/log.ts';
import { refused, warned } from '#lib/core/model/fixtures.test-support.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import type { ReminderEffectKind } from '#lib/core/data/parts/picked-effect.ts';
import { abilityState } from './ability.ts';
import { dayReminders, dayStateFromGame } from './day-reminders.ts';
import { nightStepAlerts } from './night-alerts.ts';
import {
	effectDeath,
	effectNight,
	pickedEffectOf,
	stopsKillingTonight
} from './reminder-effects.ts';

describe('pickedEffect', () => {
	const base = scenario(['chef', 'empath', 'imp'])
		.rule('angel')
		.newDay()
		.reminder('imp', 'angel', 'Something Bad')
		.reminder('chef', 'angel', 'Protected');
	const bad = base.game.seats[base.seat('imp')].reminders[0];
	const protectedToken = base.game.seats[base.seat('chef')].reminders[0];
	const pick = (
		night: number,
		reminderId = bad.reminderId,
		kind: ReminderEffectKind = 'no-kill'
	) => ({
		type: 'SetReminderEffect' as const,
		reminderId,
		effect: { kind, night }
	});
	const imp = base.seat('imp');
	/** The day view's lines about the marked player, as plain text. */
	const lines = (s: typeof base) =>
		dayReminders(dayStateFromGame(s.game, (id) => s.characters.get(id), undefined, s.characters))
			.groups.flatMap((g) => g.reminders.map((r) => ({ group: g.group, r })))
			.filter(({ r }) => /^angel#(mad|no-vote-today|dies)@/.test(r.key))
			.map(({ group, r }) => [
				group,
				r.segments
					.map((x) =>
						x.kind === 'text' ? x.text : x.kind === 'character' ? x.ref.characterId : ''
					)
					.join(' ')
			]);

	it('is offered on its token only', () => {
		expect(pickedEffectOf(bad, base.characters)).toEqual({
			token: 'Something Bad',
			effects: ['no-kill', 'poisoned', 'mad', 'no-vote-today', 'no-ability-today', 'dies']
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

	it('poisons the marked player while it is marked', () => {
		const picked = base.do(pick(2, bad.reminderId, 'poisoned'));
		const state = abilityState(picked.game, imp, picked.characters);
		expect(state.works).toBe(false);
		expect(state.impairments.map((i) => [i.reason, i.source.characterId])).toEqual([
			['poisoned', 'angel']
		]);
		// No time limit: still poisoned days later, until the Storyteller clears it.
		expect(abilityState(picked.newDay().newDay().game, imp, picked.characters).works).toBe(false);
		const cleared = picked.do({ type: 'SetReminderEffect', reminderId: bad.reminderId });
		expect(abilityState(cleared.game, imp, cleared.characters).works).toBe(true);
	});

	it('takes the ability away for a day, ending at the next New day', () => {
		const picked = base.do(pick(2, bad.reminderId, 'no-ability-today'));
		expect(
			abilityState(picked.game, imp, picked.characters).impairments.map((i) => i.reason)
		).toEqual(['no-ability']);
		expect(abilityState(picked.newDay().game, imp, picked.characters).works).toBe(true);
		// Picked at night, it waits for the coming day.
		const atNight = base.do(pick(3, bad.reminderId, 'no-ability-today'));
		expect(abilityState(atNight.game, imp, atNight.characters).works).toBe(true);
		expect(abilityState(atNight.newDay().game, imp, atNight.characters).works).toBe(false);
	});

	it('lists a player who may not vote today, for that day only', () => {
		const picked = base.do(pick(2, bad.reminderId, 'no-vote-today'));
		expect(lines(picked)).toEqual([['vote', 'imp may not vote today, because of angel']]);
		expect(lines(picked.newDay())).toEqual([]);
	});

	it('lists a mad player while it is marked', () => {
		const picked = base.do(pick(2, bad.reminderId, 'mad'));
		expect(lines(picked)).toEqual([['madness', 'imp is mad, because of angel']]);
		expect(lines(picked.newDay())).toEqual([['madness', 'imp is mad, because of angel']]);
	});

	it('offers marking the player dead by the Angel, until they die', () => {
		expect(effectDeath(base.game, bad.reminderId)).toBeUndefined();
		const picked = base.do(pick(2, bad.reminderId, 'dies'));
		expect(effectDeath(picked.game, bad.reminderId)).toBe(imp);
		expect(lines(picked)).toEqual([['execution-death', 'imp dies, because of angel']]);
		const dead = picked.do({ type: 'SetDead', seatId: imp, dead: true, cause: 'angel' });
		expect(dead.game.seats[imp].deathCause).toBe('angel');
		expect(effectDeath(dead.game, bad.reminderId)).toBeUndefined();
		expect(lines(dead)).toEqual([]);
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
			'y.pickedEffect.effects: expected some of no-kill, poisoned, mad, no-vote-today, no-ability-today, dies'
		]);
	});
});
