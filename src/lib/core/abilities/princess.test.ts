/**
 * Princess: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Princess
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Princess.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { nightStepAlerts } from '#lib/core/rules/night-alerts.ts';
import { reliability } from '#lib/core/rules/night-info.ts';
import { nightKill } from '#lib/core/rules/night-kill.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { stoppedWaking } from '#lib/core/rules/woke-tonight.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Princess', () => {
	const character = committedCharacter('princess');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition carousel', () => {
			expect(character.name).toBe('Princess');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('carousel');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(["Doesn't Kill"]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('princess')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Princess#Examples)', () => {
		it('Example 1: Vortox spares Pixie; Town Crier misled', () => {
			// Wiki: "The Princess nominates the Preacher. The Preacher is executed, and dies. That
			// night, the Vortox chooses the Pixie, who does not die. The Town Crier learns that a
			// Minion nominated today, which is false information due to the Vortox."
			const s = scenario(['princess', 'preacher', 'pixie', 'towncrier', 'witch', 'vortox'])
				.nominate('princess', 'preacher')
				.execute('preacher')
				.reminder('vortox', 'princess', "Doesn't Kill")
				.reminder('pixie', 'vortox', 'Dead');
			const alerts = nightStepAlerts(s.game, 'vortox', s.characters);
			expect(alerts).toContainEqual(
				expect.objectContaining({ kind: 'no-kill', seatId: s.seat('vortox') })
			);
			expect(s.game.seats[s.seat('pixie')].dead).toBe(false);
			expect(reliability(s.game, s.seat('towncrier'), 'towncrier', s.characters).mustBeFalse).toBe(
				true
			);
		});
		it("Example 2: Mid-game Princess survives Kazali's night attack", () => {
			// Wiki: "On night 4, the Pit-Hag turns the Dreamer into the Princess. That day, the Princess
			// nominates the Zealot, who is executed. That night, the Kazali chooses the Princess, who
			// does not die."
			// That day is the new Princess's 1st day, so the Demon doesn't kill that night.
			const s = scenario(['dreamer', 'zealot', 'chef', 'pithag', 'kazali'])
				.newDay()
				.newDay()
				.newDay()
				.becomes('dreamer', 'princess')
				.nominate('dreamer', 'zealot')
				.execute('zealot')
				.reminder('kazali', 'princess', "Doesn't Kill")
				.reminder('dreamer', 'kazali', 'Dead');
			expect(nightStepAlerts(s.game, 'kazali', s.characters)).toContainEqual(
				expect.objectContaining({ kind: 'no-kill', seatId: s.seat('kazali') })
			);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Princess#How_to_Run)', () => {
		const cast = ['princess', 'chef', 'empath', 'poisoner', 'imp'];

		it("puts Doesn't Kill on the Demon, never on another player", () => {
			// Wiki: "If the Princess nominates and executes a player, mark the Demon with the DOESN'T
			// KILL reminder."
			const s = scenario(cast).nominate('princess', 'chef').execute('chef');
			const token = { characterId: 'princess', label: "Doesn't Kill" };
			expect(reminderTargetMisses(s.game, token, s.seat('imp'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, token, s.seat('poisoner'), s.characters)).not.toEqual([]);
			expect(reminderTargetMisses(s.game, token, s.seat('empath'), s.characters)).not.toEqual([]);
		});

		it('still wakes the Demon that night, who may kill nobody', () => {
			// Wiki: "Tonight, if the Demon would wake to choose a player, wake them as normal. The
			// Demon does not kill."
			const s = scenario(cast).nominate('princess', 'chef').execute('chef');
			expect(nightKill(s.game, s.seat('imp'), 'imp', s.characters)?.max).toBe(1);
			const marked = s.reminder('imp', 'princess', "Doesn't Kill");
			expect(stoppedWaking(marked.game, marked.seat('imp'), marked.characters)).toBe(false);
			expect(nightKill(marked.game, marked.seat('imp'), 'imp', marked.characters)?.max).toBe(0);
		});
	});
});
