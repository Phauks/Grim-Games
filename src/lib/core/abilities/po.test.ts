/**
 * Po: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Po
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Po.
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
import { abilityState } from '#lib/core/rules/ability.ts';
import { preventedDeaths } from '#lib/core/rules/prevented-deaths.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { engineGap, scenario } from '#lib/core/testing/scenario.ts';

describe('Po', () => {
	const character = committedCharacter('po');

	describe('data (roles.json)', () => {
		it('is a Demon from edition bmr', () => {
			expect(character.name).toBe('Po');
			expect(character.type).toBe('demon');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Dead', 'Dead', 'Dead', '3 Attacks']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('po')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Po#Examples)', () => {
		it.fails('Example 1: Kills one, skips, then triple kill', () => {
			// Wiki: "On the second night, the Po attacks one player. On the third night, the Po chooses to
			// attack nobody. On the fourth night, the Po attacks three players."
			const s = scenario(['po', 'chef', 'empath', 'washerwoman', 'librarian', 'poisoner'])
				.reminder('chef', 'po', 'Dead')
				.dies('chef', 'po')
				.newDay()
				.reminder('po', 'po', '3 Attacks');
			const charged = { characterId: 'po', label: '3 Attacks' };
			expect(reminderTargetMisses(s.game, charged, s.seat('po'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, charged, s.seat('empath'), s.characters)).toEqual([
				'not-self'
			]);
			// Waits on the engine: nothing says how many players the Po may attack on a night.
			engineGap('M15k', 'the Po attacks one player, or three after a night it chose nobody');
		});

		it('Example 2: Poisoned triple attack fails; sober kill follows', () => {
			// Wiki: "The Po chooses to attack nobody, but is drunk. The next night, the Po is poisoned. They
			// choose three players, but none of them die. The following night, the Po is sober and healthy
			// and attacks a player, who dies."
			const cast = ['po', 'goon', 'chef', 'empath', 'washerwoman', 'librarian', 'poisoner'];
			const drunk = scenario(cast)
				.reminder('po', 'goon', 'Drunk')
				.reminder('po', 'po', '3 Attacks');
			expect(abilityState(drunk.game, drunk.seat('po'), drunk.characters).works).toBe(false);

			const poisoned = scenario(cast)
				.poisoned('po')
				.reminder('chef', 'po', 'Dead')
				.reminder('empath', 'po', 'Dead')
				.reminder('washerwoman', 'po', 'Dead');
			const survivors = preventedDeaths(poisoned.game, poisoned.characters);
			expect(survivors.map((p) => p.seatId)).toEqual([
				poisoned.seat('chef'),
				poisoned.seat('empath'),
				poisoned.seat('washerwoman')
			]);
			for (const p of survivors)
				expect(p.because).toContainEqual(expect.objectContaining({ kind: 'killer-impaired' }));

			const sober = scenario(cast).reminder('librarian', 'po', 'Dead');
			expect(preventedDeaths(sober.game, sober.characters)).toMatchObject([
				{ seatId: sober.seat('librarian'), because: [] }
			]);
		});

		it('Example 3: Drunk mid-spree; only first target dies', () => {
			// Wiki: "The Po attacks the Moonchild, then the Goon, then the Grandmother. Only the Moonchild
			// dies, because the Po became drunk when they attacked the Goon."
			const s = scenario(['po', 'moonchild', 'goon', 'grandmother', 'chef', 'poisoner'])
				.reminder('moonchild', 'po', 'Dead')
				.reminder('goon', 'po', 'Dead')
				.reminder('grandmother', 'po', 'Dead')
				.reminder('po', 'goon', 'Drunk')
				.dies('moonchild', 'po');
			const survivors = preventedDeaths(s.game, s.characters);
			expect(survivors.map((p) => p.seatId)).toEqual([s.seat('goon'), s.seat('grandmother')]);
			for (const p of survivors)
				expect(p.because).toContainEqual(
					expect.objectContaining({
						kind: 'killer-impaired',
						impairments: [expect.objectContaining({ reason: 'drunk' })]
					})
				);
		});
	});
});
