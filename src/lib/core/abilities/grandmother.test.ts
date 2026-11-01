/**
 * Grandmother: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Grandmother
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Grandmother.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { infoPicker, isAllowed, isTruthful, learnedRoles } from '#lib/core/rules/night-info.ts';
import { nightStepInfo } from '#lib/core/rules/night-info/steps.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';

describe('Grandmother', () => {
	const character = committedCharacter('grandmother');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition bmr', () => {
			expect(character.name).toBe('Grandmother');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('bmr');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Grandchild', 'Dead']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('grandmother')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('night info (https://wiki.bloodontheclocktower.com/Grandmother)', () => {
		const cast = () =>
			castGame(['grandmother', 'professor', 'butler', 'imp', 'monk'], (s) => ({
				type: 'AddReminder',
				seatId: s[1],
				reminder: { characterId: 'grandmother', label: 'Grandchild' }
			}));

		it('is shown a good Townsfolk or Outsider and their character, the Grandchild first', () => {
			const { game: g, seats } = cast();
			const picker = infoPicker(g, seats[0], 'grandmother', characters)!;
			expect(isTruthful(picker, { seats: [seats[1]], characterId: 'professor' })).toBe(true);
			expect(isTruthful(picker, { seats: [seats[2]], characterId: 'butler' })).toBe(true);
			expect(isAllowed(picker, { seats: [seats[3]], characterId: 'imp' })).toBe(false);
			expect(learnedRoles(g, picker, characters)!.rows[0]).toMatchObject({
				target: seats[1],
				characterIds: ['professor'],
				marked: true
			});
		});

		it('learns on the first night and checks her death on other nights', () => {
			const { game: g } = cast();
			expect(
				nightStepInfo(g, { id: 'grandmother' }, characters, undefined, undefined, 'first')
			).toMatchObject({
				kind: 'picker'
			});
			expect(
				nightStepInfo(g, { id: 'grandmother' }, characters, undefined, undefined, 'other')
			).toMatchObject({
				kind: 'death'
			});
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Grandmother#Examples)', () => {
		it.todo('Example 1: Grandmother dies after Demon kills Professor grandchild');
		it.todo('Example 2: Gambler grandchild dies gambling; Grandmother survives');
		it.todo('Example 3: Tinker grandchild killed, but drunk Grandmother survives');
	});
});
