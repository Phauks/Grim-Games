/**
 * Shabaloth: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Shabaloth
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Shabaloth.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import {
	committedCharacter,
	committedNightOrder,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';
import { protection } from '#lib/core/rules/ability.ts';
import { preventedDeaths } from '#lib/core/rules/prevented-deaths.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { revivedSinceNewDay } from '#lib/core/rules/night-numbers.ts';
import { revivedAfterStep } from '#lib/core/rules/revived-tonight.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { nightKill } from '#lib/core/rules/night-kill.ts';
import { placeholdersFor } from '#lib/core/rules/night-text.ts';
import { reminderPrompt } from '#lib/core/rules/reminder-prompts.ts';

describe('Shabaloth', () => {
	const character = committedCharacter('shabaloth');

	describe('data (roles.json)', () => {
		it('is a Demon from edition bmr', () => {
			expect(character.name).toBe('Shabaloth');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead', 'Dead', 'Alive']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('shabaloth')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Shabaloth#Examples)', () => {
		it('Example 1: Demon kills Gossip; Innkeeper protects Gambler', () => {
			// Wiki: "The Shabaloth attacks the Gossip, then the Gambler. The Gossip dies, but the Gambler, who
			// was protected by the Innkeeper, remains alive."
			const s = scenario(['shabaloth', 'gossip', 'gambler', 'innkeeper', 'poisoner'])
				.reminder('gambler', 'innkeeper', 'Safe')
				.reminder('gossip', 'shabaloth', 'Dead')
				.reminder('gambler', 'shabaloth', 'Dead')
				.dies('gossip', 'shabaloth');
			expect(preventedDeaths(s.game, s.characters)).toMatchObject([
				{
					killer: 'shabaloth',
					seatId: s.seat('gambler'),
					because: [{ kind: 'protected', source: { characterId: 'innkeeper' } }]
				}
			]);
		});

		it("Example 2: Courtier killed; Exorcist regurgitated, can't act yet", () => {
			// Wiki: "The Shabaloth attacks the alive Courtier and the dead Exorcist. The Courtier dies. The
			// next night, the Storyteller decides that the Exorcist becomes alive again. The Exorcist
			// doesn't act tonight--they normally act before the Shabaloth."
			const s = scenario(['shabaloth', 'courtier', 'exorcist', 'chef', 'poisoner'])
				.dies('exorcist')
				.reminder('courtier', 'shabaloth', 'Dead')
				.reminder('exorcist', 'shabaloth', 'Dead')
				.dies('courtier', 'shabaloth')
				.newDay();
			const regurgitate = { characterId: 'shabaloth', label: 'Alive' };
			expect(reminderTargetMisses(s.game, regurgitate, s.seat('exorcist'), s.characters)).toEqual(
				[]
			);
			expect(reminderTargetMisses(s.game, regurgitate, s.seat('chef'), s.characters)).toEqual(
				expect.arrayContaining(['life', 'with-label'])
			);
			// The next night the Storyteller regurgitates the Exorcist at the Shabaloth's step.
			const back = s
				.do((at) => ({ type: 'SetDead', seatId: at.seat('exorcist'), dead: false }))
				.reminder('exorcist', 'shabaloth', 'Alive');
			const revived = revivedSinceNewDay(back.session.log.entries.flatMap((e) => e.events));
			const order = committedNightOrder('otherNight');
			expect(order.indexOf('exorcist')).toBeLessThan(order.indexOf('shabaloth'));
			expect(
				revivedAfterStep(
					back.game,
					back.seat('exorcist'),
					'exorcist',
					order,
					back.characters,
					revived
				)
			).toBe(true);
			// A step after the Shabaloth's would still wake them.
			expect(
				revivedAfterStep(back.game, back.seat('exorcist'), 'dawn', order, back.characters, revived)
			).toBe(false);
		});

		it('Example 3: Protected neighbour lives; Tea Lady then dies', () => {
			// Wiki: "The Shabaloth attacks the Tea Lady’s neighbour, then the Tea Lady. The Tea Lady’s
			// neighbour, who is protected by the Tea Lady, doesn’t die, but then the Tea Lady dies."
			const s = scenario(['tealady', 'chef', 'shabaloth', 'empath', 'monk'])
				.reminder('chef', 'tealady', 'Cannot Die')
				.reminder('chef', 'shabaloth', 'Dead')
				.reminder('tealady', 'shabaloth', 'Dead');
			expect(protection(s.game, s.seat('chef'), s.characters, 'demon')).toMatchObject({
				characterId: 'tealady',
				seatId: s.seat('tealady')
			});
			// The Tea Lady protects her neighbours, not herself.
			expect(protection(s.game, s.seat('tealady'), s.characters, 'demon')).toBeUndefined();
			const after = s.dies('tealady', 'shabaloth');
			expect(after.game.seats[after.seat('chef')].dead).toBe(false);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Shabaloth#How_to_Run)', () => {
		const cast = ['shabaloth', 'gossip', 'gambler', 'chef', 'poisoner'];

		it('attacks two players each night but the first, alive or dead, each marked Dead', () => {
			// Wiki: "Each night except the first, wake the Shabaloth. They point at any two players, one
			// at a time. Put the Shabaloth to sleep. In the order chosen, each chosen player dies—mark
			// them with DEAD reminders."
			const s = scenario(cast).newDay().dies('chef', 'execution');
			expect(nightKill(s.game, s.seat('shabaloth'), 'shabaloth', s.characters)?.max).toBe(2);
			const dead = { characterId: 'shabaloth', label: 'Dead' };
			for (const seat of ['shabaloth', 'gossip', 'chef'] as const)
				expect(reminderTargetMisses(s.game, dead, s.seat(seat), s.characters), seat).toEqual([]);
			expect(placeholdersFor(character, 'other')?.slice(1)).toEqual([
				{ tokens: [{ label: 'Dead', action: 'place' }] },
				{ tokens: [{ label: 'Dead', action: 'place' }] }
			]);
		});

		it("may bring back a player it killed, marked Alive, just before the Shabaloth's attack", () => {
			// Wiki: "Each later night, just before waking the Shabaloth, you can choose one character
			// marked with the Shabaloth’s DEAD reminder, and the chosen player becomes alive again"
			expect(placeholdersFor(character, 'other')?.[0]?.tokens[0]).toEqual({
				label: 'Alive',
				action: 'place'
			});
			expect(reminderPrompt('Alive', 'shabaloth')).toBe('revive');
		});

		it("replaces the regurgitated player's Dead with Alive", () => {
			// Wiki: "replace the DEAD reminder with the Shabaloth’s ALIVE reminder, and remove their
			// shroud."
			expect(placeholdersFor(character, 'other')?.[0]).toEqual({
				tokens: [
					{ label: 'Alive', action: 'place' },
					{ label: 'Dead', action: 'remove' }
				]
			});
		});
	});
});
