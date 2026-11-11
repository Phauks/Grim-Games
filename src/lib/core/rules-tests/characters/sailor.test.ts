/**
 * Sailor: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Sailor
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Sailor.
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
import { abilityState } from '#lib/core/rules/abilities/ability.ts';
import { protection } from '#lib/core/rules/abilities/protection.ts';
import { validDeathCauses } from '#lib/core/rules/abilities/death-causes.ts';
import { preventedDeaths } from '#lib/core/rules/day/prevented-deaths.ts';
import { placeholdersFor } from '#lib/core/rules/night/night-text.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminders/reminder-targets.ts';

describe('Sailor', () => {
	const character = committedCharacter('sailor');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition bmr', () => {
			expect(character.name).toBe('Sailor');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Drunk']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('sailor')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Sailor#Examples)', () => {
		it('Example 1: Sailor picks Exorcist, survives attack and execution', () => {
			// Wiki: "The Sailor chooses the Exorcist, and the Storyteller decides that the Exorcist is drunk.
			// That night, the Sailor is attacked by the Shabaloth. The Sailor remains alive. The next day,
			// the Sailor is executed but remains alive."
			const s = scenario(['sailor', 'exorcist', 'shabaloth', 'chef', 'poisoner'])
				.reminder('exorcist', 'sailor', 'Drunk')
				.reminder('sailor', 'shabaloth', 'Dead');
			expect(preventedDeaths(s.game, s.characters)).toMatchObject([
				{
					seatId: s.seat('sailor'),
					because: [
						{ kind: 'protected', source: { characterId: 'sailor', seatId: s.seat('sailor') } }
					]
				}
			]);
			const executed = s.newDay().execute('sailor');
			expect(executed.game.seats[s.seat('sailor')].dead).toBe(false);
		});

		it("Example 2: Self-drunk Sailor dies to Gossip's kill", () => {
			// Wiki: "During the day, the Gossip made a public statement they thought was false, but was
			// actually true. That night, the Gossip ability kills a player. The Sailor has made themself
			// drunk, and the Storyteller decides that the Sailor dies."
			const s = scenario(['sailor', 'gossip', 'imp', 'chef', 'poisoner']).reminder(
				'sailor',
				'sailor',
				'Drunk'
			);
			expect(protection(s.game, s.seat('sailor'), s.characters, 'other')).toBeUndefined();
			expect(validDeathCauses(s.game, s.seat('sailor'), s.characters)).toContainEqual(
				expect.objectContaining({ cause: 'gossip', flags: [] })
			);
		});

		it('Example 3: Drunk Sailor dies after requesting execution', () => {
			// Wiki: "The Sailor chooses the Mastermind, but the Storyteller decides that the Sailor is drunk.
			// The next day, the Sailor asks to be executed to “prove they are the Sailor,” but dies because
			// they're drunk."
			const s = scenario(['sailor', 'mastermind', 'imp', 'chef', 'poisoner']).reminder(
				'sailor',
				'sailor',
				'Drunk'
			);
			expect(protection(s.game, s.seat('sailor'), s.characters, 'execution')).toBeUndefined();
			expect(s.newDay().execute('sailor').game.seats[s.seat('sailor')].dead).toBe(true);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Sailor#How_to_Run)', () => {
		const cast = ['sailor', 'exorcist', 'chef', 'empath', 'poisoner', 'imp'];

		it('marks the Sailor or the chosen player Drunk, on the first night and every other night', () => {
			// Wiki: "Each night, wake the Sailor. They point at any player. Put the Sailor to sleep.
			// Either the Sailor or this chosen player becomes drunk—mark them with the DRUNK reminder."
			const s = scenario(cast);
			const drunk = { characterId: 'sailor', label: 'Drunk' };
			for (const seat of ['sailor', 'exorcist', 'imp'] as const)
				expect(reminderTargetMisses(s.game, drunk, s.seat(seat), s.characters), seat).toEqual([]);
			for (const night of ['first', 'other'] as const)
				expect(placeholdersFor(character, night), night).toEqual([
					{ tokens: [{ label: 'Drunk', action: 'place' }] }
				]);
			const chosen = s.reminder('exorcist', 'sailor', 'Drunk');
			expect(
				abilityState(chosen.game, chosen.seat('exorcist'), chosen.characters).impairments
			).toMatchObject([{ reason: 'drunk', source: { characterId: 'sailor' } }]);
		});

		it('keeps a sober, healthy Sailor alive whatever would kill them, only the Sailor', () => {
			// Wiki: "If the sober Sailor would die, the Sailor remains alive. If the sober Sailor is
			// executed, declare that this player is executed but remains alive. (Do not say why.)"
			const s = scenario(cast).reminder('exorcist', 'sailor', 'Drunk');
			for (const by of ['demon', 'other', 'execution'] as const) {
				expect(protection(s.game, s.seat('sailor'), s.characters, by), by).toMatchObject({
					characterId: 'sailor',
					seatId: s.seat('sailor')
				});
				expect(protection(s.game, s.seat('chef'), s.characters, by), by).toBeUndefined();
			}
			const poisoned = s.poisoned('sailor');
			expect(
				protection(poisoned.game, poisoned.seat('sailor'), poisoned.characters, 'demon')
			).toBeUndefined();
		});
	});
});
