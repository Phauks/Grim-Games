/**
 * Fibbin: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Fibbin
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Fibbin.
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
import { protection } from '#lib/core/rules/ability.ts';
import { infoPicker, isAllowed, isTruthful } from '#lib/core/rules/night-info.ts';
import { characterNominationPrompts } from '#lib/core/rules/nominations.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Fibbin', () => {
	const character = committedCharacter('fibbin');

	describe('data (roles.json)', () => {
		it('is a Fabled from edition fabled', () => {
			expect(character.name).toBe('Fibbin');
			expect(character.type).toBe('fabled');
			expect(character.edition).toBe('fabled');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['No Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('fibbin')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Fibbin#Examples)', () => {
		it('Example 1: Empath is falsely told an evil neighbour', () => {
			// Wiki: "On the first night, all players get correct information. On the second night,
			// the Empath learns they are neighbouring one evil player, but both their neighbours
			// are actually good. For the rest of the game, all good players get correct
			// information."
			// Waits on the engine: the Fibbin's once-per-game false information is not known to the
			// picker, so a false number for a working good player is not allowed.
			const s = scenario(['chef', 'empath', 'monk', 'imp', 'poisoner']).rule('fibbin');
			const picker = infoPicker(s.game, s.seat('empath'), 'empath', s.characters)!;
			expect(isTruthful(picker, { seats: [], number: 0 })).toBe(true);
			expect(isAllowed(picker, { seats: [], number: 1 })).toBe(true);
		});
		it('Example 2: Dying Ravenkeeper is told false information', () => {
			// Wiki: "The Virgin is nominated by a Townsfolk. This Townsfolk is executed immediately
			// because the Fibbin cannot make an ability malfunction. Later, the Monk protects a
			// player. Again, the Monk's ability cannot fail due to the Fibbin ability. Later, the
			// Ravenkeeper dies at night and gets false information, because information from an
			// ability can be affected by the Fibbin ability."
			// The Virgin and the Monk work as normal; waits on the engine for the Ravenkeeper, whose
			// false character is not allowed while the Fibbin is unused.
			const s = scenario(['virgin', 'chef', 'monk', 'ravenkeeper', 'imp', 'poisoner']).rule(
				'fibbin'
			);
			const nomination = { nominator: s.seat('chef'), nominee: s.seat('virgin') };
			expect(characterNominationPrompts(s.game, nomination, s.characters)).toEqual([
				{ kind: 'execute-nominator', characterId: 'virgin', ...nomination }
			]);
			const safe = s.reminder('ravenkeeper', 'monk', 'Safe');
			expect(
				protection(safe.game, safe.seat('ravenkeeper'), safe.characters, 'demon')
			).toMatchObject({
				characterId: 'monk'
			});
			const dead = s.dies('ravenkeeper', 'imp');
			const picker = infoPicker(
				dead.game,
				dead.seat('ravenkeeper'),
				'ravenkeeper',
				dead.characters
			)!;
			expect(isAllowed(picker, { seats: [dead.seat('chef')], characterId: 'monk' })).toBe(true);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Fibbin#How_to_Run)', () => {
		it('never lets an evil player be given false information', () => {
			// Wiki: "Once per game, when a good player gains information from an ability, you can give
			// them incorrect information."
			const s = scenario(['chef', 'empath', 'monk', 'imp', 'poisoner'])
				.rule('fibbin')
				.do((at) => ({ type: 'SetAlignment', seatId: at.seat('empath'), alignment: 'evil' }));
			const picker = infoPicker(s.game, s.seat('empath'), 'empath', s.characters)!;
			expect(isTruthful(picker, { seats: [], number: 0 })).toBe(true);
			expect(isAllowed(picker, { seats: [], number: 1 })).toBe(false);
		});

		it('puts its No Ability reminder beside the Fibbin, not on a seat', () => {
			// Wiki: "The Fibbin loses their ability—put their NO ABILITY reminder token by their token."
			const s = scenario(['chef', 'empath', 'monk', 'imp', 'poisoner']).rule('fibbin');
			const token = { characterId: 'fibbin', label: 'No Ability' };
			expect(reminderTargetMisses(s.game, token, s.seat('empath'), s.characters)).toEqual([
				'global'
			]);
		});

		it('gives good players true information again once No Ability is beside it', () => {
			// Wiki: "Once per game, when a good player gains information from an ability, you can give
			// them incorrect information. The Fibbin loses their ability"
			const s = scenario(['chef', 'empath', 'monk', 'imp', 'poisoner'])
				.rule('fibbin')
				.do({
					type: 'AddRuleReminder',
					characterId: 'fibbin',
					reminder: { characterId: 'fibbin', label: 'No Ability' }
				});
			const picker = infoPicker(s.game, s.seat('empath'), 'empath', s.characters)!;
			expect(isTruthful(picker, { seats: [], number: 0 })).toBe(true);
			expect(isAllowed(picker, { seats: [], number: 1 })).toBe(false);
		});
	});
});
