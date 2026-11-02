/**
 * Poisoner: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Poisoner
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Poisoner.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { dayUseDeath } from '#lib/core/rules/day-claims.ts';
import { validDeathCauses } from '#lib/core/rules/death-causes.ts';
import { gameEnds, promptable } from '#lib/core/rules/game-end.ts';
import { infoPicker, isAllowed, nightAnswer } from '#lib/core/rules/night-info.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Poisoner', () => {
	const character = committedCharacter('poisoner');

	describe('data (roles.json)', () => {
		it('is a Minion from edition tb', () => {
			expect(character.name).toBe('Poisoner');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Poisoned']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('poisoner')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Poisoner#Examples)', () => {
		it("Example 1: Poisoned Slayer's shot at Imp fails", () => {
			// A poisoned Slayer's shot does nothing, even at the Imp: the app flags the Imp's death
			// to the Slayer as relying on an impaired ability, for the Storyteller (warn, never lock).
			const s = scenario(['slayer', 'imp', 'poisoner', 'chef', 'monk']).poisoned('slayer');
			expect(abilityState(s.game, s.seat('slayer'), s.characters).works).toBe(false);
			expect(dayUseDeath(s.game, 'slayer', s.seat('imp'), s.characters)).toBe('maybe');
			const cause = validDeathCauses(s.game, s.seat('imp'), s.characters, { day: true }).find(
				(c) => c.cause === 'slayer'
			);
			expect(cause?.flags).toEqual([{ code: 'impaired', seatIds: [s.seat('slayer')] }]);
		});
		it('Example 2: Poisoned Empath gets wrong count, then correct', () => {
			// Between two evil players, a poisoned Empath may be told 0; unpoisoned, only 2 is true.
			const s = scenario(['empath', 'imp', 'chef', 'monk', 'poisoner']);
			const poisoned = s.poisoned('empath');
			const picker = infoPicker(
				poisoned.game,
				poisoned.seat('empath'),
				'empath',
				poisoned.characters
			)!;
			expect(picker).toMatchObject({ unreliable: 'poisoned', range: { truth: 2 } });
			expect(isAllowed(picker, { seats: [], number: 0 })).toBe(true);
			const healthy = infoPicker(s.game, s.seat('empath'), 'empath', s.characters)!;
			expect(isAllowed(healthy, { seats: [], number: 0 })).toBe(false);
			expect(isAllowed(healthy, { seats: [], number: 2 })).toBe(true);
		});
		it('Example 3: Poisoned Investigator gets misleading Baron info', () => {
			// Poisoned, the Investigator may be shown a Baron who isn't there, among non-Minions.
			const s = scenario(['investigator', 'chef', 'monk', 'imp', 'poisoner']).poisoned(
				'investigator'
			);
			const picker = infoPicker(s.game, s.seat('investigator'), 'investigator', s.characters)!;
			expect(
				isAllowed(picker, { seats: [s.seat('chef'), s.seat('monk')], characterId: 'baron' })
			).toBe(true);
		});
		it('Example 4: Poisoned Undertaker names the wrong dead character', () => {
			// The poisoned Undertaker may be told the Virgin though the Imp was executed. Later a
			// poisoned Saint is executed and the game goes on.
			const s = scenario(['undertaker', 'virgin', 'imp', 'saint', 'poisoner', 'chef']).poisoned(
				'undertaker'
			);
			const answer = nightAnswer(
				s.execute('imp').game,
				s.seat('undertaker'),
				'undertaker',
				s.characters
			);
			expect(answer).toMatchObject({ value: 'imp', unreliable: 'poisoned' });
			const saint = s.poisoned('saint').execute('saint');
			expect(promptable(gameEnds(saint.game, saint.characters))).toEqual([]);
		});
		it('Example 5: Mayor is cured once Poisoner becomes Imp', () => {
			// With no Poisoner left in play, the poison ends.
			const s = scenario(['mayor', 'poisoner', 'imp', 'chef', 'monk']).poisoned('mayor');
			expect(abilityState(s.game, s.seat('mayor'), s.characters).works).toBe(false);
			const after = s.dies('imp', 'imp').becomes('poisoner', 'imp');
			expect(abilityState(after.game, after.seat('mayor'), after.characters).works).toBe(true);
		});
	});
});
