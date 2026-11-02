/**
 * Professor: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Professor
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Professor.
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
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { wakeConditionMet } from '#lib/core/rules/wakes-when.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

describe('Professor', () => {
	const character = committedCharacter('professor');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition bmr', () => {
			expect(character.name).toBe('Professor');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Alive', 'No Ability']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('professor')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Professor#Examples)', () => {
		const revive = { characterId: 'professor', label: 'Alive' };
		const misses = (s: Scenario, on: string) =>
			reminderTargetMisses(s.game, revive, s.seat(on), s.characters);

		it('Example 1: Chosen dead player was secretly a Lunatic', () => {
			// Wiki: "The Professor chooses a dead player who is claiming to be the Tea Lady. The player is
			// actually the Lunatic. Nobody is resurrected."
			const s = scenario(['professor', 'lunatic', 'imp', 'chef', 'poisoner']).dies('lunatic');
			expect(misses(s, 'lunatic')).toEqual(['type']);
		});

		it("Example 2: Revived Grandmother learns a good player's character", () => {
			// Wiki: "The Professor resurrects the Grandmother, who learns a good player’s character. At
			// dawn, all players learn the Grandmother player is alive, but not that the player is the
			// Grandmother."
			const s = scenario(['professor', 'grandmother', 'imp', 'chef', 'poisoner']).dies(
				'grandmother',
				'imp'
			);
			expect(misses(s, 'grandmother')).toEqual([]);
			const revived = s.do((at) => ({
				type: 'SetDead',
				seatId: at.seat('grandmother'),
				dead: false
			}));
			expect(
				abilityState(revived.game, revived.seat('grandmother'), revived.characters).works
			).toBe(true);
		});

		it.fails('Example 3: Drunk Professor picks a dead Fool', () => {
			// Wiki: "The drunk Professor chooses to resurrect the Minstrel. Unbeknownst to the Professor, the
			// Minstrel was regurgitated by the Shabaloth and is now alive. The Storyteller shakes their head
			// no, because the Professor must choose a dead player. The Professor chooses the dead Fool
			// instead. Nothing happens because the Professor is drunk, and the Professor cannot use their
			// ability again."
			const s = scenario(['professor', 'minstrel', 'shabaloth', 'fool', 'chef', 'poisoner'])
				.drunk('professor')
				.dies('minstrel', 'shabaloth')
				.do((at) => ({ type: 'SetDead', seatId: at.seat('minstrel'), dead: false }))
				.dies('fool');
			expect(misses(s, 'minstrel')).toEqual(['life']);
			expect(misses(s, 'fool')).toEqual([]);
			expect(abilityState(s.game, s.seat('professor'), s.characters).works).toBe(false);
			const spent = s.reminder('professor', 'professor', 'No Ability');
			// Waits on the engine (M15k): the Professor's step has no condition that stops it waking once its
			// No Ability token is placed (as the Seamstress's has).
			expect(
				wakeConditionMet(
					spent.game,
					'professor',
					spent.seat('professor'),
					spent.characters,
					new Set()
				)
			).toBe(false);
		});
	});
});
