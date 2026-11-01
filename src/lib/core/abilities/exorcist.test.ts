/**
 * Exorcist: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Exorcist
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Exorcist.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { nightStepAlerts } from '#lib/core/rules/night-alerts.ts';
import { nightKill } from '#lib/core/rules/night-kill.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Exorcist', () => {
	const character = committedCharacter('exorcist');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition bmr', () => {
			expect(character.name).toBe('Exorcist');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Chosen']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('exorcist')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Exorcist#Examples)', () => {
		/** The kinds of alert a character's night step shows. */
		const alerts = (s: Scenario, characterId: string) =>
			nightStepAlerts(s.game, characterId, s.characters).map((a) => a.kind);

		it('Example 1: Exorcist blocks Shabaloth, so nobody dies', () => {
			// Wiki: "The Exorcist chooses the Shabaloth. The Shabaloth does not kill tonight. At dawn,
			// the Storyteller declares that nobody died that night."
			const s = scenario(['exorcist', 'chef', 'empath', 'monk', 'shabaloth'])
				.newDay()
				.reminder('shabaloth', 'exorcist', 'Chosen');
			expect(nightStepAlerts(s.game, 'shabaloth', s.characters)).toContainEqual(
				expect.objectContaining({
					kind: 'blocked',
					seatId: s.seat('shabaloth'),
					source: expect.objectContaining({ characterId: 'exorcist', seatId: s.seat('exorcist') }),
					works: true
				})
			);
		});
		it("Example 2: Blocked Pukka's delayed death still happens", () => {
			// Wiki: "The Exorcist chooses the Pukka. The Pukka does not wake to attack tonight, but a
			// player still dies because of the Pukka’s attack during the previous night."
			// Last night the Pukka poisoned the Chef; tonight the Chef dies though the Pukka sleeps.
			const s = scenario(['exorcist', 'chef', 'empath', 'monk', 'pukka'])
				.newDay()
				.reminder('chef', 'pukka', 'Poisoned')
				.newDay()
				.reminder('pukka', 'exorcist', 'Chosen');
			expect(alerts(s, 'pukka')).toContain('blocked');
			// The Pukka chooses no one tonight, but last night's poisoned player still dies.
			expect(nightKill(s.game, s.seat('pukka'), 'pukka', s.characters)).toEqual({
				max: 0,
				delayed: [s.seat('chef')]
			});
		});
		it('Example 3: Po idles, then later strikes three', () => {
			// Wiki: "The Po chooses to attack no one. The next night, the Exorcist chooses the Po. The
			// Po does not wake to act tonight. The next night, the Exorcist chooses the Assassin. The
			// Assassin can still attack tonight, and the Po chooses three players to attack, because
			// the Po's last choice was no one."
			const cast = ['exorcist', 'chef', 'empath', 'monk', 'assassin', 'po'];
			const idle = scenario(cast).newDay().reminder('po', 'po', '3 Attacks');
			const blocked = idle.newDay().reminder('po', 'exorcist', 'Chosen');
			expect(alerts(blocked, 'po')).toContain('blocked');
			const chosen = blocked.game.seats[blocked.seat('po')].reminders.find(
				(r) => r.characterId === 'exorcist'
			)!;
			const next = blocked.newDay().do((at) => ({
				type: 'MoveReminder',
				reminderId: chosen.reminderId,
				toSeatId: at.seat('assassin')
			}));
			// The Exorcist stops only the Demon waking.
			expect(alerts(next, 'assassin')).not.toContain('blocked');
			expect(alerts(next, 'po')).not.toContain('blocked');
			// Blocked, the Po chooses no one; its 3 Attacks stays, so it attacks three next time.
			expect(nightKill(blocked.game, blocked.seat('po'), 'po', blocked.characters)?.max).toBe(0);
			expect(nightKill(next.game, next.seat('po'), 'po', next.characters)?.max).toBe(3);
		});
	});
});
